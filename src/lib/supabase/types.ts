// ============================================
// CRM SaaS MealEvent - Supabase Types
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// Database Types
// ============================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          address: string | null
          phone: string | null
          email: string | null
          website: string | null
          siret: string | null
          tva_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          siret?: string | null
          tva_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          siret?: string | null
          tva_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          slug: string
          description: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          slug: string
          description?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          slug?: string
          description?: string | null
          is_default?: boolean
          created_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          module: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          module: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          module?: string
          created_at?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string | null
          permission_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          role_id?: string | null
          permission_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role_id?: string | null
          permission_id?: string | null
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          organization_id: string | null
          role_id: string | null
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          role_id?: string | null
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role_id?: string | null
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_restaurants: {
        Row: {
          id: string
          user_id: string | null
          restaurant_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          restaurant_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          restaurant_id?: string | null
          created_at?: string
        }
      }
      restaurants: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          slug: string
          address: string | null
          city: string | null
          postal_code: string | null
          phone: string | null
          email: string | null
          description: string | null
          logo_url: string | null
          cover_url: string | null
          color: string | null
          capacity: number | null
          siret: string | null
          tva_number: string | null
          iban: string | null
          bic: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          slug: string
          address?: string | null
          city?: string | null
          postal_code?: string | null
          phone?: string | null
          email?: string | null
          description?: string | null
          logo_url?: string | null
          cover_url?: string | null
          color?: string | null
          capacity?: number | null
          siret?: string | null
          tva_number?: string | null
          iban?: string | null
          bic?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          slug?: string
          address?: string | null
          city?: string | null
          postal_code?: string | null
          phone?: string | null
          email?: string | null
          description?: string | null
          logo_url?: string | null
          cover_url?: string | null
          color?: string | null
          capacity?: number | null
          siret?: string | null
          tva_number?: string | null
          iban?: string | null
          bic?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      time_slots: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          start_time?: string
          end_time?: string
          created_at?: string
        }
      }
      restaurant_time_slots: {
        Row: {
          id: string
          restaurant_id: string | null
          time_slot_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          time_slot_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          time_slot_id?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      spaces: {
        Row: {
          id: string
          restaurant_id: string | null
          name: string
          description: string | null
          capacity: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          name: string
          description?: string | null
          capacity?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          name?: string
          description?: string | null
          capacity?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      statuses: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          slug: string
          color: string | null
          type: string
          position: number
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          slug: string
          color?: string | null
          type: string
          position?: number
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          slug?: string
          color?: string | null
          type?: string
          position?: number
          is_default?: boolean
          created_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          phone: string | null
          billing_address: string | null
          billing_postal_code: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          siret: string | null
          tva_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          phone?: string | null
          billing_address?: string | null
          billing_postal_code?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          siret?: string | null
          tva_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          phone?: string | null
          billing_address?: string | null
          billing_postal_code?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          siret?: string | null
          tva_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          organization_id: string | null
          company_id: string | null
          assigned_to: string | null
          restaurant_id: string | null
          first_name: string
          last_name: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          job_title: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          notes: string | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          company_id?: string | null
          assigned_to?: string | null
          restaurant_id?: string | null
          first_name: string
          last_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          job_title?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          notes?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          company_id?: string | null
          assigned_to?: string | null
          restaurant_id?: string | null
          first_name?: string
          last_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          job_title?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          notes?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          organization_id: string | null
          restaurant_id: string | null
          contact_id: string | null
          status_id: string | null
          assigned_to: string | null
          space_id: string | null
          time_slot_id: string | null
          event_type: string | null
          occasion: string | null
          option: string | null
          relance: string | null
          source: string | null
          event_date: string
          start_time: string | null
          end_time: string | null
          guests_count: number | null
          total_amount: number
          deposit_amount: number
          deposit_percentage: number
          is_table_blocked: boolean
          has_extra_provider: boolean
          internal_notes: string | null
          client_notes: string | null
          special_requests: string | null
          notion_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          restaurant_id?: string | null
          contact_id?: string | null
          status_id?: string | null
          assigned_to?: string | null
          space_id?: string | null
          time_slot_id?: string | null
          event_type?: string | null
          occasion?: string | null
          option?: string | null
          relance?: string | null
          source?: string | null
          event_date: string
          start_time?: string | null
          end_time?: string | null
          guests_count?: number | null
          total_amount?: number
          deposit_amount?: number
          deposit_percentage?: number
          is_table_blocked?: boolean
          has_extra_provider?: boolean
          internal_notes?: string | null
          client_notes?: string | null
          special_requests?: string | null
          notion_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          restaurant_id?: string | null
          contact_id?: string | null
          status_id?: string | null
          assigned_to?: string | null
          space_id?: string | null
          time_slot_id?: string | null
          event_type?: string | null
          occasion?: string | null
          option?: string | null
          relance?: string | null
          source?: string | null
          event_date?: string
          start_time?: string | null
          end_time?: string | null
          guests_count?: number | null
          total_amount?: number
          deposit_amount?: number
          deposit_percentage?: number
          is_table_blocked?: boolean
          has_extra_provider?: boolean
          internal_notes?: string | null
          client_notes?: string | null
          special_requests?: string | null
          notion_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      booking_events: {
        Row: {
          id: string
          booking_id: string | null
          space_id: string | null
          name: string
          event_date: string
          start_time: string | null
          end_time: string | null
          guests_count: number | null
          occasion: string | null
          is_date_flexible: boolean
          is_restaurant_flexible: boolean
          client_preferred_time: string | null
          menu_aperitif: string | null
          menu_entree: string | null
          menu_plat: string | null
          menu_dessert: string | null
          menu_boissons: string | null
          menu_details: Json | null
          mise_en_place: string | null
          deroulement: string | null
          is_privatif: boolean
          allergies_regimes: string | null
          prestations_souhaitees: string | null
          budget_client: number | null
          format_souhaite: string | null
          contact_sur_place_nom: string | null
          contact_sur_place_tel: string | null
          contact_sur_place_societe: string | null
          instructions_speciales: string | null
          commentaires: string | null
          date_signature_devis: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          space_id?: string | null
          name: string
          event_date: string
          start_time?: string | null
          end_time?: string | null
          guests_count?: number | null
          occasion?: string | null
          is_date_flexible?: boolean
          is_restaurant_flexible?: boolean
          client_preferred_time?: string | null
          menu_aperitif?: string | null
          menu_entree?: string | null
          menu_plat?: string | null
          menu_dessert?: string | null
          menu_boissons?: string | null
          menu_details?: Json | null
          mise_en_place?: string | null
          deroulement?: string | null
          is_privatif?: boolean
          allergies_regimes?: string | null
          prestations_souhaitees?: string | null
          budget_client?: number | null
          format_souhaite?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_tel?: string | null
          contact_sur_place_societe?: string | null
          instructions_speciales?: string | null
          commentaires?: string | null
          date_signature_devis?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          space_id?: string | null
          name?: string
          event_date?: string
          start_time?: string | null
          end_time?: string | null
          guests_count?: number | null
          occasion?: string | null
          is_date_flexible?: boolean
          is_restaurant_flexible?: boolean
          client_preferred_time?: string | null
          menu_aperitif?: string | null
          menu_entree?: string | null
          menu_plat?: string | null
          menu_dessert?: string | null
          menu_boissons?: string | null
          menu_details?: Json | null
          mise_en_place?: string | null
          deroulement?: string | null
          is_privatif?: boolean
          allergies_regimes?: string | null
          prestations_souhaitees?: string | null
          budget_client?: number | null
          format_souhaite?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_tel?: string | null
          contact_sur_place_societe?: string | null
          instructions_speciales?: string | null
          commentaires?: string | null
          date_signature_devis?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      booking_products_services: {
        Row: {
          id: string
          booking_id: string | null
          restaurant_id: string | null
          name: string
          description: string | null
          quantity: number
          unit_price: number
          tva_rate: number
          discount_amount: number
          discount_percentage: number
          total_ht: number | null
          total_ttc: number | null
          is_provider: boolean
          provider_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          restaurant_id?: string | null
          name: string
          description?: string | null
          quantity?: number
          unit_price: number
          tva_rate?: number
          discount_amount?: number
          discount_percentage?: number
          total_ht?: number | null
          total_ttc?: number | null
          is_provider?: boolean
          provider_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          restaurant_id?: string | null
          name?: string
          description?: string | null
          quantity?: number
          unit_price?: number
          tva_rate?: number
          discount_amount?: number
          discount_percentage?: number
          total_ht?: number | null
          total_ttc?: number | null
          is_provider?: boolean
          provider_name?: string | null
          created_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          organization_id: string | null
          booking_id: string | null
          contact_id: string | null
          quote_number: string
          total_ht: number
          total_tva: number
          total_ttc: number
          discount_amount: number
          status: string
          signature_requested_at: string | null
          signed_at: string | null
          signature_url: string | null
          signer_name: string | null
          signer_email: string | null
          valid_until: string | null
          notes: string | null
          terms: string | null
          pdf_url: string | null
          title: string | null
          date_start: string | null
          date_end: string | null
          order_number: string | null
          discount_percentage: number
          deposit_percentage: number
          deposit_label: string | null
          deposit_days: number
          balance_label: string | null
          balance_days: number
          quote_date: string | null
          quote_due_days: number
          invoice_due_days: number
          comments_fr: string | null
          comments_en: string | null
          conditions_devis: string | null
          conditions_facture: string | null
          conditions_acompte: string | null
          conditions_solde: string | null
          language: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          contact_id?: string | null
          quote_number: string
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          discount_amount?: number
          status?: string
          signature_requested_at?: string | null
          signed_at?: string | null
          signature_url?: string | null
          signer_name?: string | null
          signer_email?: string | null
          valid_until?: string | null
          notes?: string | null
          terms?: string | null
          pdf_url?: string | null
          title?: string | null
          date_start?: string | null
          date_end?: string | null
          order_number?: string | null
          discount_percentage?: number
          deposit_percentage?: number
          deposit_label?: string | null
          deposit_days?: number
          balance_label?: string | null
          balance_days?: number
          quote_date?: string | null
          quote_due_days?: number
          invoice_due_days?: number
          comments_fr?: string | null
          comments_en?: string | null
          conditions_devis?: string | null
          conditions_facture?: string | null
          conditions_acompte?: string | null
          conditions_solde?: string | null
          language?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          contact_id?: string | null
          quote_number?: string
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          discount_amount?: number
          status?: string
          signature_requested_at?: string | null
          signed_at?: string | null
          signature_url?: string | null
          signer_name?: string | null
          signer_email?: string | null
          valid_until?: string | null
          notes?: string | null
          terms?: string | null
          pdf_url?: string | null
          title?: string | null
          date_start?: string | null
          date_end?: string | null
          order_number?: string | null
          discount_percentage?: number
          deposit_percentage?: number
          deposit_label?: string | null
          deposit_days?: number
          balance_label?: string | null
          balance_days?: number
          quote_date?: string | null
          quote_due_days?: number
          invoice_due_days?: number
          comments_fr?: string | null
          comments_en?: string | null
          conditions_devis?: string | null
          conditions_facture?: string | null
          conditions_acompte?: string | null
          conditions_solde?: string | null
          language?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string | null
          booking_product_service_id: string | null
          name: string
          description: string | null
          quantity: number
          unit_price: number
          tva_rate: number
          discount_amount: number
          total_ht: number | null
          total_ttc: number | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id?: string | null
          booking_product_service_id?: string | null
          name: string
          description?: string | null
          quantity?: number
          unit_price: number
          tva_rate?: number
          discount_amount?: number
          total_ht?: number | null
          total_ttc?: number | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string | null
          booking_product_service_id?: string | null
          name?: string
          description?: string | null
          quantity?: number
          unit_price?: number
          tva_rate?: number
          discount_amount?: number
          total_ht?: number | null
          total_ttc?: number | null
          position?: number
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          organization_id: string | null
          booking_id: string | null
          quote_id: string | null
          amount: number
          payment_type: string
          payment_method: string | null
          stripe_payment_id: string | null
          stripe_payment_intent_id: string | null
          status: string
          paid_at: string | null
          notes: string | null
          attachment_url: string | null
          attachment_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          quote_id?: string | null
          amount: number
          payment_type: string
          payment_method?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          status?: string
          paid_at?: string | null
          notes?: string | null
          attachment_url?: string | null
          attachment_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          quote_id?: string | null
          amount?: number
          payment_type?: string
          payment_method?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          status?: string
          paid_at?: string | null
          notes?: string | null
          attachment_url?: string | null
          attachment_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payment_links: {
        Row: {
          id: string
          booking_id: string | null
          quote_id: string | null
          link_type: string
          amount: number
          percentage: number | null
          url: string
          stripe_link_id: string | null
          is_active: boolean
          expires_at: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          quote_id?: string | null
          link_type: string
          amount: number
          percentage?: number | null
          url: string
          stripe_link_id?: string | null
          is_active?: boolean
          expires_at?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          quote_id?: string | null
          link_type?: string
          amount?: number
          percentage?: number | null
          url?: string
          stripe_link_id?: string | null
          is_active?: boolean
          expires_at?: string | null
          used_at?: string | null
          created_at?: string
        }
      }
      payment_reminders: {
        Row: {
          id: string
          booking_id: string | null
          payment_id: string | null
          reminder_type: string
          sent_at: string | null
          opened_at: string | null
          clicked_at: string | null
          subject: string | null
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          payment_id?: string | null
          reminder_type: string
          sent_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          subject?: string | null
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          payment_id?: string | null
          reminder_type?: string
          sent_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          subject?: string | null
          message?: string | null
          created_at?: string
        }
      }
      receipts: {
        Row: {
          id: string
          booking_id: string | null
          amount: number
          payment_method: string | null
          photo_url: string | null
          description: string | null
          items: Json | null
          submitted_by: string | null
          submitted_at: string
          validated_by: string | null
          validated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          amount: number
          payment_method?: string | null
          photo_url?: string | null
          description?: string | null
          items?: Json | null
          submitted_by?: string | null
          submitted_at?: string
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          amount?: number
          payment_method?: string | null
          photo_url?: string | null
          description?: string | null
          items?: Json | null
          submitted_by?: string | null
          submitted_at?: string
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string | null
          booking_id: string | null
          name: string
          file_type: string | null
          file_size: number | null
          file_path: string
          file_url: string
          uploaded_by: string | null
          description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          name: string
          file_type?: string | null
          file_size?: number | null
          file_path: string
          file_url: string
          uploaded_by?: string | null
          description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          booking_id?: string | null
          name?: string
          file_type?: string | null
          file_size?: number | null
          file_path?: string
          file_url?: string
          uploaded_by?: string | null
          description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          organization_id: string | null
          default_currency: string
          default_tva_rate: number
          default_deposit_percentage: number
          quote_validity_days: number
          quote_prefix: string
          quote_terms: string | null
          email_sender_name: string | null
          email_signature: string | null
          stripe_account_id: string | null
          stripe_public_key: string | null
          stripe_secret_key: string | null
          notify_new_booking: boolean
          notify_payment_received: boolean
          notify_quote_signed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          default_currency?: string
          default_tva_rate?: number
          default_deposit_percentage?: number
          quote_validity_days?: number
          quote_prefix?: string
          quote_terms?: string | null
          email_sender_name?: string | null
          email_signature?: string | null
          stripe_account_id?: string | null
          stripe_public_key?: string | null
          stripe_secret_key?: string | null
          notify_new_booking?: boolean
          notify_payment_received?: boolean
          notify_quote_signed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          default_currency?: string
          default_tva_rate?: number
          default_deposit_percentage?: number
          quote_validity_days?: number
          quote_prefix?: string
          quote_terms?: string | null
          email_sender_name?: string | null
          email_signature?: string | null
          stripe_account_id?: string | null
          stripe_public_key?: string | null
          stripe_secret_key?: string | null
          notify_new_booking?: boolean
          notify_payment_received?: boolean
          notify_quote_signed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// ============================================
// Helper Types
// ============================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience types
export type Organization = Tables<'organizations'>
export type User = Tables<'users'>
export type Role = Tables<'roles'>
export type Permission = Tables<'permissions'>
export type Restaurant = Tables<'restaurants'>
export type TimeSlot = Tables<'time_slots'>
export type Space = Tables<'spaces'>
export type Status = Tables<'statuses'>
export type Company = Tables<'companies'>
export type Contact = Tables<'contacts'>
export type Booking = Tables<'bookings'>
export type BookingEvent = Tables<'booking_events'>
export type BookingProductService = Tables<'booking_products_services'>
export type Quote = Tables<'quotes'>
export type QuoteItem = Tables<'quote_items'>
export type Payment = Tables<'payments'>
export type PaymentLink = Tables<'payment_links'>
export type PaymentReminder = Tables<'payment_reminders'>
export type Receipt = Tables<'receipts'>
export type Document = Tables<'documents'>
export type Settings = Tables<'settings'>

// Extended types with relations
export type ContactWithRelations = Contact & {
  company?: Company | null
  status?: Status | null
  assigned_user?: User | null
  bookings?: Booking[]
}

export type BookingWithRelations = Booking & {
  restaurant?: Restaurant | null
  contact?: Contact | null
  status?: Status | null
  assigned_user?: User | null
  space?: Space | null
  time_slot?: TimeSlot | null
  events?: BookingEvent[]
  products_services?: BookingProductService[]
  quotes?: Quote[]
  payments?: Payment[]
}

export type QuoteWithRelations = Quote & {
  booking?: BookingWithRelations | null
  items?: QuoteItem[]
  payments?: Payment[]
}

export type UserWithRelations = User & {
  role?: Role | null
  restaurants?: Restaurant[]
}
