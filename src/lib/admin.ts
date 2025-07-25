import { supabase } from './supabase'
import type { User, Pet, Subscription, Admin, SupportTicket } from './supabase'

// Admin service functions
export const adminService = {
  // Get dashboard analytics
  async getDashboardAnalytics() {
    try {
      // Get user count
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (userError) throw userError

      // Get pet count
      const { count: petCount, error: petError } = await supabase
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (petError) throw petError

      // Get active subscription count
      const { count: activeSubscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (subError) throw subError

      // Get total scans
      const { data: scanData, error: scanError } = await supabase
        .from('qr_scans')
        .select('id')

      if (scanError) throw scanError

      // Get revenue (sum of active subscriptions)
      const { data: revenueData, error: revenueError } = await supabase
        .from('subscriptions')
        .select('amount')
        .eq('status', 'active')

      if (revenueError) throw revenueError

      const totalRevenue = revenueData?.reduce((sum, sub) => sum + sub.amount, 0) || 0

      return {
        totalUsers: userCount || 0,
        totalPets: petCount || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalScans: scanData?.length || 0,
        totalRevenue,
        currency: 'INR'
      }
    } catch (error) {
      console.error('Get dashboard analytics error:', error)
      throw error
    }
  },

  // Get all users with pagination
  async getAllUsers(limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions (
            status,
            end_date,
            plan_type
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get all users error:', error)
      throw error
    }
  },

  // Search users
  async searchUsers(query: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions (
            status,
            end_date,
            plan_type
          )
        `)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Search users error:', error)
      throw error
    }
  },

  // Update user status
  async updateUserStatus(userId: number, isActive: boolean) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Update user status error:', error)
      throw error
    }
  },

  // Activate user
  async activateUser(userId: number) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          is_active: true,
          email_verified: true,
          email_verified_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Activate user error:', error)
      throw error
    }
  },

  // Deactivate user
  async deactivateUser(userId: number) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Deactivate user error:', error)
      throw error
    }
  },

  // Get user details with pets and subscription
  async getUserDetails(userId: number) {
    try {
      // Get user info
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get user's pets
      const { data: pets, error: petsError } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (petsError) throw petsError

      // Get user's subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (subsError) throw subsError

      return {
        user,
        pets: pets || [],
        subscriptions: subscriptions || []
      }
    } catch (error) {
      console.error('Get user details error:', error)
      throw error
    }
  },

  // Create subscription for user
  async createSubscription(userId: number, subscriptionData: {
    plan_type: 'annual' | 'monthly'
    amount: number
    start_date: string
    end_date: string
    payment_method?: string
    payment_reference?: string
  }) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([{
          user_id: userId,
          plan_type: subscriptionData.plan_type,
          status: 'active',
          amount: subscriptionData.amount,
          currency: 'INR',
          start_date: subscriptionData.start_date,
          end_date: subscriptionData.end_date,
          payment_method: subscriptionData.payment_method,
          payment_reference: subscriptionData.payment_reference
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Create subscription error:', error)
      throw error
    }
  },

  // Update subscription status
  async updateSubscriptionStatus(subscriptionId: number, status: 'active' | 'expired' | 'cancelled' | 'pending') {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ status })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Update subscription status error:', error)
      throw error
    }
  },

  // Update subscription (for renewals)
  async updateSubscription(subscriptionId: number, updates: {
    status?: 'active' | 'expired' | 'cancelled' | 'pending'
    start_date?: string
    end_date?: string
    amount?: number
    payment_method?: string
    payment_reference?: string
  }) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscriptionId)
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            whatsapp,
            is_active
          )
        `)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Update subscription error:', error)
      throw error
    }
  },

  // Get support tickets
  async getSupportTickets(limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          users (
            name,
            email
          ),
          pets (
            name,
            username
          ),
          admins (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get support tickets error:', error)
      throw error
    }
  },

  // Update support ticket
  async updateSupportTicket(ticketId: number, updates: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed'
    admin_id?: number
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }) {
    try {
      const updateData: any = { ...updates }
      
      if (updates.status === 'resolved' || updates.status === 'closed') {
        updateData.resolved_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Update support ticket error:', error)
      throw error
    }
  },

  // Get scan analytics
  async getScanAnalytics(days: number = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await supabase
        .from('qr_scans')
        .select(`
          *,
          pets (
            name,
            username,
            users (
              name
            )
          )
        `)
        .gte('scanned_at', startDate.toISOString())
        .order('scanned_at', { ascending: false })

      if (error) throw error

      // Group scans by date
      const scansByDate: Record<string, number> = {}
      const citiesScanData: Record<string, number> = {}
      let totalWhatsAppShares = 0

      data?.forEach(scan => {
        const date = new Date(scan.scanned_at).toISOString().split('T')[0]
        scansByDate[date] = (scansByDate[date] || 0) + 1

        if (scan.scanner_city) {
          citiesScanData[scan.scanner_city] = (citiesScanData[scan.scanner_city] || 0) + 1
        }

        if (scan.whatsapp_shared) {
          totalWhatsAppShares++
        }
      })

      return {
        totalScans: data?.length || 0,
        whatsappShares: totalWhatsAppShares,
        scansByDate,
        topCities: Object.entries(citiesScanData)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([city, count]) => ({ city, count })),
        recentScans: data?.slice(0, 20) || []
      }
    } catch (error) {
      console.error('Get scan analytics error:', error)
      throw error
    }
  },

  // Get all pets with owner information
  async getAllPetsWithOwners(limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabase
        .from('pets')
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            whatsapp,
            instagram,
            address
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get all pets with owners error:', error)
      throw error
    }
  },

  // Update pet details (admin function)
  async updatePet(petId: number, updates: {
    name?: string
    username?: string
    type?: 'Dog' | 'Cat' | 'Bird' | 'Rabbit' | 'Other'
    breed?: string
    age?: string
    color?: string
    description?: string
    photo_url?: string
    show_phone?: boolean
    show_whatsapp?: boolean
    show_instagram?: boolean
    show_address?: boolean
    is_active?: boolean
    is_lost?: boolean
  }) {
    try {
      const { data, error } = await supabase
        .from('pets')
        .update(updates)
        .eq('id', petId)
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            whatsapp,
            instagram,
            address
          )
        `)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Update pet error:', error)
      throw error
    }
  },

  // Get revenue analytics
  async getRevenueAnalytics() {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculate revenue by month
      const revenueByMonth: Record<string, number> = {}
      let totalRevenue = 0
      let activeSubscriptions = 0

      data?.forEach(subscription => {
        const month = new Date(subscription.created_at).toISOString().slice(0, 7) // YYYY-MM
        revenueByMonth[month] = (revenueByMonth[month] || 0) + subscription.amount

        if (subscription.status === 'active') {
          totalRevenue += subscription.amount
          activeSubscriptions++
        }
      })

      return {
        totalRevenue,
        activeSubscriptions,
        averageRevenue: activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0,
        revenueByMonth: Object.entries(revenueByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, revenue]) => ({ month, revenue }))
      }
    } catch (error) {
      console.error('Get revenue analytics error:', error)
      throw error
    }
  },

  // Create support ticket
  async createSupportTicket(ticketData: {
    user_id?: number
    pet_id?: number
    subject: string
    description: string
    category: 'technical' | 'billing' | 'lost_pet' | 'account' | 'other'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    contact_email?: string
    contact_phone?: string
  }) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: ticketData.user_id,
          pet_id: ticketData.pet_id,
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category,
          priority: ticketData.priority || 'medium',
          status: 'open',
          contact_email: ticketData.contact_email,
          contact_phone: ticketData.contact_phone
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Create support ticket error:', error)
      throw error
    }
  },

  // Get all subscriptions with user data
  async getAllSubscriptions() {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            whatsapp,
            is_active
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get all subscriptions error:', error)
      throw error
    }
  },

  // Get subscriptions nearing expiry (within next 30 days)
  async getSubscriptionsNearingExpiry(daysAhead: number = 30) {
    try {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + daysAhead)
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            whatsapp,
            is_active
          )
        `)
        .eq('status', 'active')
        .lte('end_date', futureDate.toISOString().split('T')[0])
        .order('end_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get subscriptions nearing expiry error:', error)
      throw error
    }
  },

  // Get users with subscription status
  async getUsersWithSubscriptions() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions (
            id,
            status,
            plan_type,
            amount,
            start_date,
            end_date,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Get users with subscriptions error:', error)
      throw error
    }
  }
} 