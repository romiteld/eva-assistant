// WebRTC Signaling Server for Screen/Camera Sharing
import { Server, Socket } from 'socket.io';

interface RTCSessionData {
  roomId: string;
  userId: string;
  streamType: 'camera' | 'screen' | 'both';
  isRecording?: boolean;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class WebRTCSignalingServer {
  private io: Server;
  private rooms: Map<string, Set<string>>;
  private sessions: Map<string, RTCSessionData>;
  private recordings: Map<string, any>;

  // STUN/TURN servers configuration
  private iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for better connectivity
    {
      urls: process.env.TURN_SERVER_URL || 'turn:turn.example.com:3478',
      username: process.env.TURN_USERNAME || 'username',
      credential: process.env.TURN_CREDENTIAL || 'password'
    }
  ];

  constructor(io: Server) {
    this.io = io;
    this.rooms = new Map();
    this.sessions = new Map();
    this.recordings = new Map();
  }

  handleConnection(socket: Socket) {
    const userId = socket.data.userId;

    // Get ICE servers configuration
    socket.on('rtc:get-config', () => {
      socket.emit('rtc:config', {
        iceServers: this.iceServers,
        // Additional WebRTC constraints
        constraints: {
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2
          }
        }
      });
    });

    // Join a room
    socket.on('rtc:join-room', async (data: {
      roomId: string;
      streamType: 'camera' | 'screen' | 'both';
    }) => {
      const { roomId, streamType } = data;
      
      // Leave previous room if any
      this.leaveCurrentRoom(socket);

      // Join new room
      socket.join(`rtc:${roomId}`);
      
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }
      this.rooms.get(roomId)!.add(socket.id);

      // Store session data
      this.sessions.set(socket.id, {
        roomId,
        userId,
        streamType
      });

      // Notify others in the room
      socket.to(`rtc:${roomId}`).emit('rtc:user-joined', {
        userId,
        socketId: socket.id,
        streamType
      });

      // Send list of existing peers
      const peers = Array.from(this.rooms.get(roomId)!)
        .filter(id => id !== socket.id)
        .map(id => ({
          socketId: id,
          userId: this.sessions.get(id)?.userId,
          streamType: this.sessions.get(id)?.streamType
        }));

      socket.emit('rtc:existing-peers', peers);
    });

    // Handle offer
    socket.on('rtc:offer', (data: {
      targetSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      socket.to(data.targetSocketId).emit('rtc:offer', {
        fromSocketId: socket.id,
        offer: data.offer
      });
    });

    // Handle answer
    socket.on('rtc:answer', (data: {
      targetSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      socket.to(data.targetSocketId).emit('rtc:answer', {
        fromSocketId: socket.id,
        answer: data.answer
      });
    });

    // Handle ICE candidates
    socket.on('rtc:ice-candidate', (data: {
      targetSocketId: string;
      candidate: RTCIceCandidate;
    }) => {
      socket.to(data.targetSocketId).emit('rtc:ice-candidate', {
        fromSocketId: socket.id,
        candidate: data.candidate
      });
    });

    // Handle quality adaptation
    socket.on('rtc:request-quality-change', (data: {
      targetSocketId: string;
      quality: 'low' | 'medium' | 'high';
      streamType: 'video' | 'screen';
    }) => {
      socket.to(data.targetSocketId).emit('rtc:quality-change-request', {
        fromSocketId: socket.id,
        quality: data.quality,
        streamType: data.streamType
      });
    });

    // Handle recording
    socket.on('rtc:start-recording', async (data: {
      roomId: string;
      streamType: 'local' | 'remote' | 'both';
    }) => {
      const session = this.sessions.get(socket.id);
      if (!session || session.roomId !== data.roomId) {
        socket.emit('rtc:recording-error', {
          error: 'Not in the specified room'
        });
        return;
      }

      // Initialize recording (in production, this would integrate with a media server)
      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.recordings.set(recordingId, {
        roomId: data.roomId,
        userId,
        startTime: Date.now(),
        streamType: data.streamType,
        status: 'recording'
      });

      session.isRecording = true;

      socket.emit('rtc:recording-started', { recordingId });
      socket.to(`rtc:${data.roomId}`).emit('rtc:peer-recording-status', {
        userId,
        isRecording: true
      });
    });

    socket.on('rtc:stop-recording', (recordingId: string) => {
      const recording = this.recordings.get(recordingId);
      if (recording && recording.userId === userId) {
        recording.status = 'stopped';
        recording.endTime = Date.now();
        
        const session = this.sessions.get(socket.id);
        if (session) {
          session.isRecording = false;
        }

        socket.emit('rtc:recording-stopped', {
          recordingId,
          duration: recording.endTime - recording.startTime
        });

        // Notify peers
        if (session) {
          socket.to(`rtc:${session.roomId}`).emit('rtc:peer-recording-status', {
            userId,
            isRecording: false
          });
        }
      }
    });

    // Handle stream control
    socket.on('rtc:toggle-stream', (data: {
      streamType: 'audio' | 'video';
      enabled: boolean;
    }) => {
      const session = this.sessions.get(socket.id);
      if (session) {
        socket.to(`rtc:${session.roomId}`).emit('rtc:peer-stream-toggle', {
          userId,
          socketId: socket.id,
          streamType: data.streamType,
          enabled: data.enabled
        });
      }
    });

    // Handle screen share quality optimization
    socket.on('rtc:optimize-screenshare', (data: {
      resolution: string; // e.g., "1920x1080"
      frameRate: number;
      bitrate: number;
    }) => {
      const session = this.sessions.get(socket.id);
      if (session) {
        socket.to(`rtc:${session.roomId}`).emit('rtc:screenshare-settings', {
          userId,
          settings: data
        });
      }
    });

    // Leave room
    socket.on('rtc:leave-room', () => {
      this.leaveCurrentRoom(socket);
    });
  }

  private leaveCurrentRoom(socket: Socket) {
    const session = this.sessions.get(socket.id);
    if (session) {
      const { roomId } = session;
      
      // Remove from room
      socket.leave(`rtc:${roomId}`);
      this.rooms.get(roomId)?.delete(socket.id);
      
      // Clean up empty rooms
      if (this.rooms.get(roomId)?.size === 0) {
        this.rooms.delete(roomId);
      }

      // Notify others
      socket.to(`rtc:${roomId}`).emit('rtc:user-left', {
        userId: session.userId,
        socketId: socket.id
      });

      // Clean up session
      this.sessions.delete(socket.id);
    }
  }

  handleDisconnect(socket: Socket) {
    this.leaveCurrentRoom(socket);
    
    // Clean up any recordings
    for (const [recordingId, recording] of this.recordings) {
      if (recording.userId === socket.data.userId && recording.status === 'recording') {
        recording.status = 'interrupted';
        recording.endTime = Date.now();
      }
    }
  }
}