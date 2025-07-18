'use client'

/* eslint-disable react/display-name */

import React from 'react'
import { LucideIcon } from 'lucide-react'

// Import only the icons we actually use to reduce bundle size
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  MessageSquare, 
  Settings, 
  User, 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  Edit, 
  Delete, 
  Save, 
  Cancel, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Upload, 
  Download, 
  RefreshCw, 
  Loader2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeOff, 
  Calendar, 
  Clock, 
  Mail, 
  FileText, 
  File, 
  Folder, 
  FolderOpen, 
  Image, 
  Video, 
  Music, 
  Play, 
  Pause, 
  Stop, 
  Volume2, 
  VolumeX, 
  Home, 
  Menu, 
  MoreVertical, 
  MoreHorizontal, 
  Bell, 
  BellOff, 
  Heart, 
  HeartOff, 
  Star, 
  StarOff, 
  Share, 
  Link, 
  Copy, 
  Clipboard, 
  Trash2, 
  Archive, 
  Bookmark, 
  BookmarkOff, 
  Tag, 
  Tags, 
  Flag, 
  FlagOff, 
  Lock, 
  Unlock, 
  Shield, 
  ShieldOff, 
  Key, 
  LogIn, 
  LogOut, 
  UserPlus, 
  UserMinus, 
  UserCheck, 
  UserX, 
  Activity, 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Lightbulb, 
  Brain, 
  Cpu, 
  Database, 
  Server, 
  Globe, 
  Wifi, 
  WifiOff, 
  Bluetooth, 
  BluetoothOff, 
  Package, 
  PackageOpen, 
  Truck, 
  ShoppingCart, 
  CreditCard, 
  DollarSign, 
  Euro, 
  Pound, 
  Yen, 
  Building, 
  Building2, 
  MapPin, 
  Navigation, 
  Compass, 
  Map, 
  Route, 
  Car, 
  Plane, 
  Train, 
  Ship, 
  Bicycle, 
  Camera, 
  Smartphone, 
  Tablet, 
  Laptop, 
  Monitor, 
  Tv, 
  Speaker, 
  Headphones, 
  Gamepad2, 
  Keyboard, 
  Mouse, 
  Printer, 
  Scanner, 
  Fax, 
  HardDrive, 
  Usb, 
  Wifi as WifiIcon, 
  Bluetooth as BluetoothIcon, 
  Battery, 
  BatteryLow, 
  Plug, 
  Power, 
  PowerOff, 
  Sun, 
  Moon, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  Thermometer, 
  Umbrella, 
  Wind, 
  Snowflake, 
  Sunrise, 
  Sunset, 
  Mountain, 
  TreePine, 
  Flower, 
  Leaf, 
  Droplets, 
  Flame, 
  Zap as Lightning, 
  Gauge, 
  Meter, 
  Scale, 
  Ruler, 
  Timer, 
  Stopwatch, 
  Hourglass, 
  AlarmClock, 
  Calendar as CalendarIcon, 
  CalendarDays, 
  CalendarCheck, 
  CalendarX, 
  CalendarClock, 
  CalendarHeart, 
  CalendarRange, 
  CalendarMinus, 
  CalendarPlus
} from 'lucide-react'

// Icon name to component mapping
const iconMap = {
  // Audio/Voice
  'mic': Mic,
  'mic-off': MicOff,
  'phone': Phone,
  'phone-off': PhoneOff,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  'play': Play,
  'pause': Pause,
  'stop': Stop,
  'music': Music,
  'speaker': Speaker,
  'headphones': Headphones,
  
  // Communication
  'message-square': MessageSquare,
  'mail': Mail,
  'share': Share,
  'link': Link,
  'copy': Copy,
  'clipboard': Clipboard,
  
  // Navigation
  'home': Home,
  'menu': Menu,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  
  // Actions
  'plus': Plus,
  'minus': Minus,
  'edit': Edit,
  'delete': Delete,
  'save': Save,
  'cancel': Cancel,
  'check': Check,
  'x': X,
  'search': Search,
  'filter': Filter,
  'refresh-cw': RefreshCw,
  'upload': Upload,
  'download': Download,
  'more-vertical': MoreVertical,
  'more-horizontal': MoreHorizontal,
  'trash-2': Trash2,
  'archive': Archive,
  
  // Status
  'loader-2': Loader2,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'info': Info,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'eye': Eye,
  'eye-off': EyeOff,
  'bell': Bell,
  'bell-off': BellOff,
  'heart': Heart,
  'heart-off': HeartOff,
  'star': Star,
  'star-off': StarOff,
  'flag': Flag,
  'flag-off': FlagOff,
  'bookmark': Bookmark,
  'bookmark-off': BookmarkOff,
  
  // Users
  'user': User,
  'users': Users,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  'user-check': UserCheck,
  'user-x': UserX,
  'log-in': LogIn,
  'log-out': LogOut,
  
  // Files
  'file-text': FileText,
  'file': File,
  'folder': Folder,
  'folder-open': FolderOpen,
  'image': Image,
  'video': Video,
  
  // Security
  'lock': Lock,
  'unlock': Unlock,
  'shield': Shield,
  'shield-off': ShieldOff,
  'key': Key,
  
  // Settings
  'settings': Settings,
  'tag': Tag,
  'tags': Tags,
  
  // Analytics
  'activity': Activity,
  'bar-chart-3': BarChart3,
  'line-chart': LineChart,
  'pie-chart': PieChart,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'target': Target,
  'gauge': Gauge,
  'meter': Meter,
  'scale': Scale,
  'ruler': Ruler,
  
  // Technology
  'brain': Brain,
  'cpu': Cpu,
  'database': Database,
  'server': Server,
  'globe': Globe,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'bluetooth': Bluetooth,
  'bluetooth-off': BluetoothOff,
  'zap': Zap,
  'lightbulb': Lightbulb,
  'package': Package,
  'package-open': PackageOpen,
  
  // Devices
  'camera': Camera,
  'smartphone': Smartphone,
  'tablet': Tablet,
  'laptop': Laptop,
  'monitor': Monitor,
  'tv': Tv,
  'gamepad-2': Gamepad2,
  'keyboard': Keyboard,
  'mouse': Mouse,
  'printer': Printer,
  'scanner': Scanner,
  'fax': Fax,
  'hard-drive': HardDrive,
  'usb': Usb,
  'battery': Battery,
  'battery-low': BatteryLow,
  'plug': Plug,
  'power': Power,
  'power-off': PowerOff,
  
  // Time
  'clock': Clock,
  'calendar': Calendar,
  'calendar-days': CalendarDays,
  'calendar-check': CalendarCheck,
  'calendar-x': CalendarX,
  'calendar-clock': CalendarClock,
  'calendar-heart': CalendarHeart,
  'calendar-range': CalendarRange,
  'calendar-minus': CalendarMinus,
  'calendar-plus': CalendarPlus,
  'timer': Timer,
  'stopwatch': Stopwatch,
  'hourglass': Hourglass,
  'alarm-clock': AlarmClock,
  
  // Commerce
  'truck': Truck,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  'dollar-sign': DollarSign,
  'euro': Euro,
  'pound': Pound,
  'yen': Yen,
  
  // Location
  'building': Building,
  'building-2': Building2,
  'map-pin': MapPin,
  'navigation': Navigation,
  'compass': Compass,
  'map': Map,
  'route': Route,
  'car': Car,
  'plane': Plane,
  'train': Train,
  'ship': Ship,
  'bicycle': Bicycle,
  
  // Weather/Nature
  'sun': Sun,
  'moon': Moon,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
  'thermometer': Thermometer,
  'umbrella': Umbrella,
  'wind': Wind,
  'snowflake': Snowflake,
  'sunrise': Sunrise,
  'sunset': Sunset,
  'mountain': Mountain,
  'tree-pine': TreePine,
  'flower': Flower,
  'leaf': Leaf,
  'droplets': Droplets,
  'flame': Flame
} as const

export type IconName = keyof typeof iconMap

interface OptimizedIconProps {
  name: IconName
  size?: number
  className?: string
  color?: string
  strokeWidth?: number
}

// Memoized icon component to prevent unnecessary re-renders
export const OptimizedIcon = React.memo<OptimizedIconProps>(({ 
  name, 
  size = 24, 
  className = "",
  color = "currentColor",
  strokeWidth = 2
}) => {
  const IconComponent = iconMap[name]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in OptimizedIcon`)
    return null
  }
  
  return (
    <IconComponent
      size={size}
      className={className}
      color={color}
      strokeWidth={strokeWidth}
    />
  )
})

OptimizedIcon.displayName = 'OptimizedIcon'

// Export commonly used icons as individual components for better tree shaking
export const MicIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="mic" {...props} />
)

export const PhoneIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="phone" {...props} />
)

export const MessageIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="message-square" {...props} />
)

export const SettingsIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="settings" {...props} />
)

export const UserIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="user" {...props} />
)

export const SearchIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="search" {...props} />
)

export const EditIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="edit" {...props} />
)

export const DeleteIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="trash-2" {...props} />
)

export const SaveIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="save" {...props} />
)

export const CheckIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="check" {...props} />
)

export const CloseIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="x" {...props} />
)

export const LoaderIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="loader-2" {...props} />
)

export const AlertIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="alert-triangle" {...props} />
)

export const InfoIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="info" {...props} />
)

export const HomeIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="home" {...props} />
)

export const MenuIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="menu" {...props} />
)

export const ChevronLeftIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="chevron-left" {...props} />
)

export const ChevronRightIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="chevron-right" {...props} />
)

export const CalendarIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="calendar" {...props} />
)

export const ClockIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="clock" {...props} />
)

export const FileIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="file-text" {...props} />
)

export const FolderIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="folder" {...props} />
)

export const BrainIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="brain" {...props} />
)

export const ZapIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="zap" {...props} />
)

export const BarChartIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="bar-chart-3" {...props} />
)

export const TrendingUpIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="trending-up" {...props} />
)

export const TrendingDownIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="trending-down" {...props} />
)

export const ActivityIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="activity" {...props} />
)

export const PackageIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="package" {...props} />
)

export const GaugeIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="gauge" {...props} />
)

export const TargetIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="target" {...props} />
)

export const RefreshIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="refresh-cw" {...props} />
)

export const DownloadIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="download" {...props} />
)

export const UploadIcon = React.memo<Omit<OptimizedIconProps, 'name'>>((props) => 
  <OptimizedIcon name="upload" {...props} />
)

export default OptimizedIcon