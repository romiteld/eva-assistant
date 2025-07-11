// Zoho CRM Integration
import axios from 'axios'

export class ZohoCRMClient {
  private accessToken: string
  private refreshToken: string
  private clientId: string
  private clientSecret: string
  private baseUrl: string = 'https://www.zohoapis.com/crm/v2'

  constructor(config: {
    accessToken: string
    refreshToken: string
    clientId: string
    clientSecret: string
  }) {
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post(
        'https://accounts.zoho.com/oauth/v2/token',
        null,
        {
          params: {
            refresh_token: this.refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token'
          }
        }
      )
      
      this.accessToken = response.data.access_token
      return this.accessToken
    } catch (error) {
      console.error('Error refreshing Zoho token:', error)
      throw error
    }
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        data
      })
      
      return response.data
    } catch (error) {
      if (error instanceof Error && 'response' in error && (error as any).response?.status === 401) {
        // Token expired, refresh and retry
        await this.refreshAccessToken()
        return this.makeRequest(endpoint, method, data)
      }
      throw error
    }
  }

  // Contacts/Candidates Management
  async createContact(contactData: any) {
    return this.makeRequest('/Contacts', 'POST', {
      data: [contactData]
    })
  }

  async getContacts(params?: { page?: number; per_page?: number; fields?: string[] }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.makeRequest(`/Contacts?${queryParams}`)
  }

  async updateContact(id: string, updateData: any) {
    return this.makeRequest(`/Contacts/${id}`, 'PUT', {
      data: [updateData]
    })
  }

  async searchContacts(criteria: string) {
    return this.makeRequest(`/Contacts/search?criteria=${encodeURIComponent(criteria)}`)
  }

  // Deals/Placements Management
  async createDeal(dealData: any) {
    return this.makeRequest('/Deals', 'POST', {
      data: [dealData]
    })
  }

  async getDeals(params?: { page?: number; per_page?: number; fields?: string[] }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.makeRequest(`/Deals?${queryParams}`)
  }

  async updateDeal(id: string, updateData: any) {
    return this.makeRequest(`/Deals/${id}`, 'PUT', {
      data: [updateData]
    })
  }

  async getDealStages() {
    return this.makeRequest('/settings/pipeline')
  }

  // Tasks Management
  async createTask(taskData: any) {
    return this.makeRequest('/Tasks', 'POST', {
      data: [taskData]
    })
  }

  async getTasks(params?: { page?: number; per_page?: number }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.makeRequest(`/Tasks?${queryParams}`)
  }

  // Notes
  async addNote(parentModule: string, parentId: string, noteContent: string) {
    return this.makeRequest('/Notes', 'POST', {
      data: [{
        Note_Title: 'AI Generated Note',
        Note_Content: noteContent,
        Parent_Id: parentId,
        se_module: parentModule
      }]
    })
  }

  // Activities
  async logCall(callData: {
    subject: string
    callType: 'Outbound' | 'Inbound'
    callStartTime: string
    callDuration: string
    relatedTo: { id: string; module: string }
  }) {
    return this.makeRequest('/Calls', 'POST', {
      data: [{
        Subject: callData.subject,
        Call_Type: callData.callType,
        Call_Start_Time: callData.callStartTime,
        Call_Duration: callData.callDuration,
        Who_Id: callData.relatedTo.module === 'Contacts' ? callData.relatedTo.id : null,
        What_Id: callData.relatedTo.module === 'Deals' ? callData.relatedTo.id : null
      }]
    })
  }

  // Webhooks
  async subscribeWebhook(events: string[], notifyUrl: string) {
    return this.makeRequest('/actions/watch', 'POST', {
      watch: [{
        channel_id: Math.random().toString(36).substring(7),
        events,
        channel_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        token: process.env.ZOHO_WEBHOOK_TOKEN,
        notify_url: notifyUrl
      }]
    })
  }

  // Bulk Operations
  async bulkCreateContacts(contacts: any[]) {
    return this.makeRequest('/Contacts/bulk', 'POST', {
      data: contacts
    })
  }

  async bulkUpdateDeals(deals: { id: string; data: any }[]) {
    return this.makeRequest('/Deals/bulk', 'PUT', {
      data: deals.map(d => ({ ...d.data, id: d.id }))
    })
  }

  // Analytics
  async getAnalytics(module: string, params?: any) {
    const queryParams = new URLSearchParams(params).toString()
    return this.makeRequest(`/analytics/${module}?${queryParams}`)
  }

  // Custom Functions for Recruiting
  async createCandidatePlacement(candidateData: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    currentCompany?: string
    currentPosition?: string
    linkedinUrl?: string
    skills?: string[]
    notes?: string
  }, dealData: {
    dealName: string
    stage: string
    amount?: number
    closingDate?: string
    probability?: number
  }) {
    // Create contact first
    const contact = await this.createContact({
      First_Name: candidateData.firstName,
      Last_Name: candidateData.lastName,
      Email: candidateData.email,
      Phone: candidateData.phone,
      Title: candidateData.currentPosition,
      Account_Name: candidateData.currentCompany,
      LinkedIn_URL: candidateData.linkedinUrl,
      Skills: candidateData.skills?.join(', '),
      Description: candidateData.notes
    })

    // Create associated deal
    const deal = await this.createDeal({
      Deal_Name: dealData.dealName,
      Stage: dealData.stage,
      Amount: dealData.amount,
      Closing_Date: dealData.closingDate,
      Probability: dealData.probability,
      Contact_Name: contact.data[0].details.id
    })

    return { contact, deal }
  }

  async updatePlacementStatus(dealId: string, status: string, notes?: string) {
    const updateData: any = {
      Stage: status
    }

    if (notes) {
      await this.addNote('Deals', dealId, notes)
    }

    return this.updateDeal(dealId, updateData)
  }

  async searchCandidatesBySkills(skills: string[]) {
    const criteria = skills.map(skill => `(Skills:contains:${skill})`).join('or')
    return this.searchContacts(criteria)
  }
}