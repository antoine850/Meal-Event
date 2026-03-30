export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_label: string
          action_type: string
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          booking_id: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action_label: string
          action_type: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          booking_id: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          action_label?: string
          action_type?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          booking_id?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          allergies_regimes: string | null
          booking_id: string | null
          budget_client: string | null
          client_preferred_time: string | null
          commentaires: string | null
          contact_sur_place_nom: string | null
          contact_sur_place_societe: string | null
          contact_sur_place_tel: string | null
          created_at: string | null
          date_signature_devis: string | null
          deroulement: string | null
          end_time: string | null
          event_date: string
          format_souhaite: string | null
          guests_count: number | null
          id: string
          instructions_speciales: string | null
          is_date_flexible: boolean | null
          is_privatif: boolean | null
          is_restaurant_flexible: boolean | null
          menu_aperitif: string | null
          menu_boissons: string | null
          menu_dessert: string | null
          menu_details: Json | null
          menu_entree: string | null
          menu_plat: string | null
          mise_en_place: string | null
          name: string
          prestations_souhaitees: string | null
          space_id: string | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          allergies_regimes?: string | null
          booking_id?: string | null
          budget_client?: string | null
          client_preferred_time?: string | null
          commentaires?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_societe?: string | null
          contact_sur_place_tel?: string | null
          created_at?: string | null
          date_signature_devis?: string | null
          deroulement?: string | null
          end_time?: string | null
          event_date: string
          format_souhaite?: string | null
          guests_count?: number | null
          id?: string
          instructions_speciales?: string | null
          is_date_flexible?: boolean | null
          is_privatif?: boolean | null
          is_restaurant_flexible?: boolean | null
          menu_aperitif?: string | null
          menu_boissons?: string | null
          menu_dessert?: string | null
          menu_details?: Json | null
          menu_entree?: string | null
          menu_plat?: string | null
          mise_en_place?: string | null
          name: string
          prestations_souhaitees?: string | null
          space_id?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          allergies_regimes?: string | null
          booking_id?: string | null
          budget_client?: string | null
          client_preferred_time?: string | null
          commentaires?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_societe?: string | null
          contact_sur_place_tel?: string | null
          created_at?: string | null
          date_signature_devis?: string | null
          deroulement?: string | null
          end_time?: string | null
          event_date?: string
          format_souhaite?: string | null
          guests_count?: number | null
          id?: string
          instructions_speciales?: string | null
          is_date_flexible?: boolean | null
          is_privatif?: boolean | null
          is_restaurant_flexible?: boolean | null
          menu_aperitif?: string | null
          menu_boissons?: string | null
          menu_dessert?: string | null
          menu_details?: Json | null
          menu_entree?: string | null
          menu_plat?: string | null
          mise_en_place?: string | null
          name?: string
          prestations_souhaitees?: string | null
          space_id?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_extras: {
        Row: {
          booking_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          quantity: number | null
          total_ht: number | null
          total_ttc: number | null
          tva_rate: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          quantity?: number | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          quantity?: number | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_extras_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_extras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_menu_forms: {
        Row: {
          booking_id: string
          client_comment: string | null
          created_at: string
          guests_count: number
          id: string
          menu_form_id: string
          share_token: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          client_comment?: string | null
          created_at?: string
          guests_count?: number
          id?: string
          menu_form_id: string
          share_token?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          client_comment?: string | null
          created_at?: string
          guests_count?: number
          id?: string
          menu_form_id?: string
          share_token?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_menu_forms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_menu_forms_menu_form_id_fkey"
            columns: ["menu_form_id"]
            isOneToOne: false
            referencedRelation: "menu_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_products_services: {
        Row: {
          booking_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          is_provider: boolean | null
          name: string
          provider_name: string | null
          quantity: number | null
          restaurant_id: string | null
          total_ht: number | null
          total_ttc: number | null
          tva_rate: number | null
          unit_price: number
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          is_provider?: boolean | null
          name: string
          provider_name?: string | null
          quantity?: number | null
          restaurant_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price: number
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          is_provider?: boolean | null
          name?: string
          provider_name?: string | null
          quantity?: number | null
          restaurant_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_products_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_services_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          allergies_regimes: string | null
          assigned_to: string | null
          assigned_user_ids: string[] | null
          budget_client: string | null
          client_preferred_time: string | null
          commentaires: string | null
          contact_id: string | null
          contact_sur_place_nom: string | null
          contact_sur_place_societe: string | null
          contact_sur_place_tel: string | null
          created_at: string | null
          date_signature_devis: string | null
          client_notes: string | null
          deposit_amount: number | null
          deposit_percentage: number | null
          deroulement: string | null
          end_time: string | null
          event_date: string
          event_type: string | null
          format_souhaite: string | null
          google_calendar_event_id: string | null
          guests_count: number | null
          has_extra_provider: boolean | null
          id: string
          instructions_speciales: string | null
          internal_notes: string | null
          is_date_flexible: boolean | null
          is_privatif: boolean | null
          is_restaurant_flexible: boolean | null
          is_table_blocked: boolean | null
          menu_aperitif: string | null
          menu_boissons: string | null
          menu_dessert: string | null
          menu_details: Json | null
          menu_entree: string | null
          menu_plat: string | null
          mise_en_place: string | null
          notion_url: string | null
          occasion: string | null
          option: string | null
          organization_id: string | null
          prestations_souhaitees: string | null
          relance: string | null
          restaurant_id: string | null
          source: string | null
          special_requests: string | null
          time_slot_id: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_term: string | null
          fbclid: string | null
          fbc: string | null
          space_id: string | null
          start_time: string | null
          status_id: string | null
          total_amount: number | null
          read_at: string | null
          updated_at: string | null
        }
        Insert: {
          allergies_regimes?: string | null
          assigned_to?: string | null
          assigned_user_ids?: string[] | null
          budget_client?: string | null
          client_preferred_time?: string | null
          commentaires?: string | null
          contact_id?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_societe?: string | null
          contact_sur_place_tel?: string | null
          created_at?: string | null
          date_signature_devis?: string | null
          client_notes?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          deroulement?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string | null
          format_souhaite?: string | null
          google_calendar_event_id?: string | null
          guests_count?: number | null
          has_extra_provider?: boolean | null
          id?: string
          instructions_speciales?: string | null
          internal_notes?: string | null
          is_date_flexible?: boolean | null
          is_privatif?: boolean | null
          is_restaurant_flexible?: boolean | null
          is_table_blocked?: boolean | null
          menu_aperitif?: string | null
          menu_boissons?: string | null
          menu_dessert?: string | null
          menu_details?: Json | null
          menu_entree?: string | null
          menu_plat?: string | null
          mise_en_place?: string | null
          notion_url?: string | null
          occasion?: string | null
          option?: string | null
          organization_id?: string | null
          prestations_souhaitees?: string | null
          relance?: string | null
          restaurant_id?: string | null
          source?: string | null
          special_requests?: string | null
          time_slot_id?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_term?: string | null
          fbclid?: string | null
          fbc?: string | null
          space_id?: string | null
          start_time?: string | null
          status_id?: string | null
          read_at?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          allergies_regimes?: string | null
          assigned_to?: string | null
          assigned_user_ids?: string[] | null
          budget_client?: string | null
          client_notes?: string | null
          client_preferred_time?: string | null
          commentaires?: string | null
          contact_id?: string | null
          contact_sur_place_nom?: string | null
          contact_sur_place_societe?: string | null
          contact_sur_place_tel?: string | null
          created_at?: string | null
          date_signature_devis?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          deroulement?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string | null
          format_souhaite?: string | null
          google_calendar_event_id?: string | null
          guests_count?: number | null
          has_extra_provider?: boolean | null
          id?: string
          instructions_speciales?: string | null
          internal_notes?: string | null
          is_date_flexible?: boolean | null
          is_privatif?: boolean | null
          is_restaurant_flexible?: boolean | null
          is_table_blocked?: boolean | null
          menu_aperitif?: string | null
          menu_boissons?: string | null
          menu_dessert?: string | null
          menu_details?: Json | null
          menu_entree?: string | null
          menu_plat?: string | null
          mise_en_place?: string | null
          notion_url?: string | null
          occasion?: string | null
          option?: string | null
          organization_id?: string | null
          prestations_souhaitees?: string | null
          relance?: string | null
          restaurant_id?: string | null
          source?: string | null
          special_requests?: string | null
          time_slot_id?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_term?: string | null
          fbclid?: string | null
          fbc?: string | null
          space_id?: string | null
          start_time?: string | null
          status_id?: string | null
          read_at?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_postal_code: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          tva_number: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string | null
          mobile: string | null
          notes: string | null
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          source: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_term: string | null
          fbclid: string | null
          fbc: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          source?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_term?: string | null
          fbclid?: string | null
          fbc?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          source?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_term?: string | null
          fbclid?: string | null
          fbc?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          booking_id: string | null
          created_at: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          organization_id: string | null
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          organization_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          organization_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          booking_id: string | null
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          organization_id: string | null
          quote_id: string | null
          recipient_email: string
          reply_to_email: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          quote_id?: string | null
          recipient_email: string
          reply_to_email?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          quote_id?: string | null
          recipient_email?: string
          reply_to_email?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_form_fields: {
        Row: {
          created_at: string
          description: string | null
          field_type: string
          id: string
          is_per_person: boolean
          is_required: boolean
          label: string
          menu_form_id: string
          options: Json | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_type?: string
          id?: string
          is_per_person?: boolean
          is_required?: boolean
          label: string
          menu_form_id: string
          options?: Json | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          field_type?: string
          id?: string
          is_per_person?: boolean
          is_required?: boolean
          label?: string
          menu_form_id?: string
          options?: Json | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_form_fields_menu_form_id_fkey"
            columns: ["menu_form_id"]
            isOneToOne: false
            referencedRelation: "menu_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_form_responses: {
        Row: {
          booking_menu_form_id: string | null
          created_at: string
          field_id: string
          guest_index: number
          id: string
          menu_form_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          booking_menu_form_id?: string | null
          created_at?: string
          field_id: string
          guest_index?: number
          id?: string
          menu_form_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          booking_menu_form_id?: string | null
          created_at?: string
          field_id?: string
          guest_index?: number
          id?: string
          menu_form_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_form_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "menu_form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_form_responses_menu_form_id_fkey"
            columns: ["menu_form_id"]
            isOneToOne: false
            referencedRelation: "menu_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_forms: {
        Row: {
          booking_id: string | null
          client_comment: string | null
          created_at: string
          description: string | null
          guests_count: number
          id: string
          organization_id: string | null
          restaurant_id: string | null
          share_token: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_comment?: string | null
          created_at?: string
          description?: string | null
          guests_count?: number
          id?: string
          organization_id?: string | null
          restaurant_id?: string | null
          share_token?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_comment?: string | null
          created_at?: string
          description?: string | null
          guests_count?: number
          id?: string
          organization_id?: string | null
          restaurant_id?: string | null
          share_token?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_forms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_forms_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          facturation_email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          siret: string | null
          slug: string
          tva_number: string | null
          updated_at: string | null
          website: string | null
          meta_pixel_id: string | null
          meta_conversions_token: string | null
          api_key_hash: string | null
          api_key_prefix: string | null
          api_key_last_used_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          facturation_email?: string | null
          id?: string
          logo_url?: string | null
          meta_pixel_id?: string | null
          meta_conversions_token?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_key_last_used_at?: string | null
          name: string
          phone?: string | null
          siret?: string | null
          slug: string
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          facturation_email?: string | null
          id?: string
          logo_url?: string | null
          meta_pixel_id?: string | null
          meta_conversions_token?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_key_last_used_at?: string | null
          name?: string
          phone?: string | null
          siret?: string | null
          slug?: string
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      package_products: {
        Row: {
          id: string
          package_id: string
          product_id: string
          quantity: number | null
        }
        Insert: {
          id?: string
          package_id: string
          product_id: string
          quantity?: number | null
        }
        Update: {
          id?: string
          package_id?: string
          product_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_products_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      package_restaurants: {
        Row: {
          id: string
          package_id: string
          restaurant_id: string
        }
        Insert: {
          id?: string
          package_id: string
          restaurant_id: string
        }
        Update: {
          id?: string
          package_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_restaurants_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          price_per_person: boolean
          tva_rate: number
          unit_price_ht: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          price_per_person?: boolean
          tva_rate?: number
          unit_price_ht?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          price_per_person?: boolean
          tva_rate?: number
          unit_price_ht?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          link_type: string
          percentage: number | null
          quote_id: string | null
          stripe_link_id: string | null
          url: string
          used_at: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link_type: string
          percentage?: number | null
          quote_id?: string | null
          stripe_link_id?: string | null
          url: string
          used_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string
          percentage?: number | null
          quote_id?: string | null
          stripe_link_id?: string | null
          url?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          booking_id: string | null
          clicked_at: string | null
          created_at: string | null
          id: string
          message: string | null
          opened_at: string | null
          payment_id: string | null
          reminder_type: string
          sent_at: string | null
          subject: string | null
        }
        Insert: {
          booking_id?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          payment_id?: string | null
          reminder_type: string
          sent_at?: string | null
          subject?: string | null
        }
        Update: {
          booking_id?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          payment_id?: string | null
          reminder_type?: string
          sent_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_modality: string | null
          payment_type: string
          quote_id: string | null
          status: string | null
          stripe_payment_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_modality?: string | null
          payment_type: string
          quote_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_modality?: string | null
          payment_type?: string
          quote_id?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_restaurants: {
        Row: {
          id: string
          product_id: string
          restaurant_id: string
        }
        Insert: {
          id?: string
          product_id: string
          restaurant_id: string
        }
        Update: {
          id?: string
          product_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_restaurants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          margin: number | null
          name: string
          old_id: string | null
          organization_id: string
          price_per_person: boolean | null
          tag: string | null
          tva_rate: number
          type: string
          unit_price_ht: number
          unit_price_ttc: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          margin?: number | null
          name: string
          old_id?: string | null
          organization_id: string
          price_per_person?: boolean | null
          tag?: string | null
          tva_rate?: number
          type: string
          unit_price_ht?: number
          unit_price_ttc?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          margin?: number | null
          name?: string
          old_id?: string | null
          organization_id?: string
          price_per_person?: boolean | null
          tag?: string | null
          tva_rate?: number
          type?: string
          unit_price_ht?: number
          unit_price_ttc?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          booking_product_service_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          id: string
          item_type: string | null
          name: string
          position: number | null
          quantity: number | null
          quote_id: string | null
          total_ht: number | null
          total_ttc: number | null
          tva_rate: number | null
          unit_price: number
        }
        Insert: {
          booking_product_service_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          item_type?: string | null
          name: string
          position?: number | null
          quantity?: number | null
          quote_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price: number
        }
        Update: {
          booking_product_service_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          item_type?: string | null
          name?: string
          position?: number | null
          quantity?: number | null
          quote_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_booking_product_service_id_fkey"
            columns: ["booking_product_service_id"]
            isOneToOne: false
            referencedRelation: "booking_products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          additional_conditions: string | null
          balance_days: number | null
          balance_label: string | null
          balance_paid_at: string | null
          balance_sent_at: string | null
          booking_id: string | null
          comments_en: string | null
          comments_fr: string | null
          conditions_acompte: string | null
          conditions_devis: string | null
          conditions_facture: string | null
          conditions_solde: string | null
          contact_id: string | null
          created_at: string | null
          date_end: string | null
          date_start: string | null
          deposit_days: number | null
          deposit_label: string | null
          deposit_paid_at: string | null
          deposit_percentage: number | null
          deposit_sent_at: string | null
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          invoice_due_days: number | null
          language: string | null
          notes: string | null
          order_number: string | null
          organization_id: string | null
          pdf_url: string | null
          primary_quote: boolean | null
          quote_date: string | null
          quote_due_days: number | null
          quote_number: string
          quote_sent_at: string | null
          quote_signed_at: string | null
          signature_requested_at: string | null
          signature_url: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          signer_email: string | null
          signer_name: string | null
          signnow_document_id: string | null
          signnow_invite_id: string | null
          status: string | null
          stripe_balance_session_id: string | null
          stripe_balance_url: string | null
          stripe_deposit_session_id: string | null
          stripe_deposit_url: string | null
          terms: string | null
          title: string | null
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          updated_at: string | null
          valid_until: string | null
          version: number | null
        }
        Insert: {
          additional_conditions?: string | null
          balance_days?: number | null
          balance_label?: string | null
          balance_paid_at?: string | null
          balance_sent_at?: string | null
          booking_id?: string | null
          comments_en?: string | null
          comments_fr?: string | null
          conditions_acompte?: string | null
          conditions_devis?: string | null
          conditions_facture?: string | null
          conditions_solde?: string | null
          contact_id?: string | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          deposit_days?: number | null
          deposit_label?: string | null
          deposit_paid_at?: string | null
          deposit_percentage?: number | null
          deposit_sent_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_due_days?: number | null
          language?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id?: string | null
          pdf_url?: string | null
          primary_quote?: boolean | null
          quote_date?: string | null
          quote_due_days?: number | null
          quote_number: string
          quote_sent_at?: string | null
          quote_signed_at?: string | null
          signature_requested_at?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signnow_document_id?: string | null
          signnow_invite_id?: string | null
          status?: string | null
          stripe_balance_session_id?: string | null
          stripe_balance_url?: string | null
          stripe_deposit_session_id?: string | null
          stripe_deposit_url?: string | null
          terms?: string | null
          title?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Update: {
          additional_conditions?: string | null
          balance_days?: number | null
          balance_label?: string | null
          balance_paid_at?: string | null
          balance_sent_at?: string | null
          booking_id?: string | null
          comments_en?: string | null
          comments_fr?: string | null
          conditions_acompte?: string | null
          conditions_devis?: string | null
          conditions_facture?: string | null
          conditions_solde?: string | null
          contact_id?: string | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          deposit_days?: number | null
          deposit_label?: string | null
          deposit_paid_at?: string | null
          deposit_percentage?: number | null
          deposit_sent_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_due_days?: number | null
          language?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id?: string | null
          pdf_url?: string | null
          primary_quote?: boolean | null
          quote_date?: string | null
          quote_due_days?: number | null
          quote_number?: string
          quote_sent_at?: string | null
          quote_signed_at?: string | null
          signature_requested_at?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signnow_document_id?: string | null
          signnow_invite_id?: string | null
          status?: string | null
          stripe_balance_session_id?: string | null
          stripe_balance_url?: string | null
          stripe_deposit_session_id?: string | null
          stripe_deposit_url?: string | null
          terms?: string | null
          title?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          description: string | null
          id: string
          items: Json | null
          payment_method: string | null
          photo_url: string | null
          submitted_at: string | null
          submitted_by: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          items?: Json | null
          payment_method?: string | null
          photo_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          items?: Json | null
          payment_method?: string | null
          photo_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          bank_name: string | null
          bic: string | null
          billing_additional_text: string | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          cc_export_emails: string[] | null
          city: string | null
          client_portal_background_url: string | null
          color: string | null
          company_name: string | null
          counter_signature_enabled: boolean | null
          country: string | null
          created_at: string | null
          currency: string | null
          display_mode: string | null
          email: string | null
          email_signature_enabled: boolean | null
          email_signature_text: string | null
          email_tracking_enabled: boolean | null
          event_reminder_enabled: boolean | null
          facebook: string | null
          google_calendar_email: string | null
          google_calendar_id: string | null
          google_calendar_sync_enabled: boolean | null
          google_refresh_token: string | null
          iban: string | null
          id: string
          instagram: string | null
          invoice_due_days: number | null
          invoice_prefix: string | null
          is_active: boolean | null
          language: string | null
          legal_form: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          notification_emails: string[] | null
          organization_id: string | null
          payment_balance_days: number | null
          phone: string | null
          postal_code: string | null
          quote_validity_days: number | null
          rcs: string | null
          recap_email: string | null
          recap_emails: string[] | null
          share_capital: string | null
          siren: string | null
          siret: string | null
          slug: string
          sms_name: string | null
          sms_signature: string | null
          sms_signature_en: string | null
          stripe_enabled: boolean
          translation_language: string | null
          tva_number: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_name?: string | null
          bic?: string | null
          billing_additional_text?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          cc_export_emails?: string[] | null
          city?: string | null
          client_portal_background_url?: string | null
          color?: string | null
          company_name?: string | null
          counter_signature_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          display_mode?: string | null
          email?: string | null
          email_signature_enabled?: boolean | null
          email_signature_text?: string | null
          email_tracking_enabled?: boolean | null
          event_reminder_enabled?: boolean | null
          facebook?: string | null
          google_calendar_email?: string | null
          google_calendar_id?: string | null
          google_calendar_sync_enabled?: boolean | null
          google_refresh_token?: string | null
          iban?: string | null
          id?: string
          instagram?: string | null
          invoice_due_days?: number | null
          invoice_prefix?: string | null
          is_active?: boolean | null
          language?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          notification_emails?: string[] | null
          organization_id?: string | null
          payment_balance_days?: number | null
          phone?: string | null
          postal_code?: string | null
          quote_validity_days?: number | null
          rcs?: string | null
          recap_email?: string | null
          recap_emails?: string[] | null
          share_capital?: string | null
          siren?: string | null
          siret?: string | null
          slug: string
          sms_name?: string | null
          sms_signature?: string | null
          sms_signature_en?: string | null
          stripe_enabled?: boolean
          translation_language?: string | null
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_name?: string | null
          bic?: string | null
          billing_additional_text?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          cc_export_emails?: string[] | null
          city?: string | null
          client_portal_background_url?: string | null
          color?: string | null
          company_name?: string | null
          counter_signature_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          display_mode?: string | null
          email?: string | null
          email_signature_enabled?: boolean | null
          email_signature_text?: string | null
          email_tracking_enabled?: boolean | null
          event_reminder_enabled?: boolean | null
          facebook?: string | null
          google_calendar_email?: string | null
          google_calendar_id?: string | null
          google_calendar_sync_enabled?: boolean | null
          google_refresh_token?: string | null
          iban?: string | null
          id?: string
          instagram?: string | null
          invoice_due_days?: number | null
          invoice_prefix?: string | null
          is_active?: boolean | null
          language?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          notification_emails?: string[] | null
          organization_id?: string | null
          payment_balance_days?: number | null
          phone?: string | null
          postal_code?: string | null
          quote_validity_days?: number | null
          rcs?: string | null
          recap_email?: string | null
          recap_emails?: string[] | null
          share_capital?: string | null
          siren?: string | null
          siret?: string | null
          slug?: string
          sms_name?: string | null
          sms_signature?: string | null
          sms_signature_en?: string | null
          stripe_enabled?: boolean
          translation_language?: string | null
          tva_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          default_currency: string | null
          default_deposit_percentage: number | null
          default_tva_rate: number | null
          email_sender_name: string | null
          email_signature: string | null
          id: string
          notify_new_booking: boolean | null
          notify_payment_received: boolean | null
          notify_quote_signed: boolean | null
          organization_id: string | null
          quote_prefix: string | null
          quote_terms: string | null
          quote_validity_days: number | null
          stripe_account_id: string | null
          stripe_public_key: string | null
          stripe_secret_key: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_currency?: string | null
          default_deposit_percentage?: number | null
          default_tva_rate?: number | null
          email_sender_name?: string | null
          email_signature?: string | null
          id?: string
          notify_new_booking?: boolean | null
          notify_payment_received?: boolean | null
          notify_quote_signed?: boolean | null
          organization_id?: string | null
          quote_prefix?: string | null
          quote_terms?: string | null
          quote_validity_days?: number | null
          stripe_account_id?: string | null
          stripe_public_key?: string | null
          stripe_secret_key?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_currency?: string | null
          default_deposit_percentage?: number | null
          default_tva_rate?: number | null
          email_sender_name?: string | null
          email_signature?: string | null
          id?: string
          notify_new_booking?: boolean | null
          notify_payment_received?: boolean | null
          notify_quote_signed?: boolean | null
          organization_id?: string | null
          quote_prefix?: string | null
          quote_terms?: string | null
          quote_validity_days?: number | null
          stripe_account_id?: string | null
          stripe_public_key?: string | null
          stripe_secret_key?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          capacity: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          nom_public: string | null
          ordre: number | null
          organization_id: string | null
          restaurant_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          nom_public?: string | null
          ordre?: number | null
          organization_id?: string | null
          restaurant_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          nom_public?: string | null
          ordre?: number | null
          organization_id?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          position: number | null
          slug: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          position?: number | null
          slug: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          position?: number | null
          slug?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_restaurants: {
        Row: {
          created_at: string | null
          id: string
          restaurant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_restaurants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          role_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          role_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          role_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_activity_logs: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


// Convenience types
export type Organization = Tables<'organizations'>
export type User = Tables<'users'>
export type Role = Tables<'roles'>
export type Permission = Tables<'permissions'>
export type Restaurant = Tables<'restaurants'>
export type Space = Tables<'spaces'>
export type Status = Tables<'statuses'>
export type Company = Tables<'companies'>
export type Contact = Tables<'contacts'>
export type Booking = Tables<'bookings'>
export type BookingEvent = Tables<'booking_events'>
export type BookingExtra = Tables<'booking_extras'>
export type BookingProductService = Tables<'booking_products_services'>
export type Quote = Tables<'quotes'>
export type QuoteItem = Tables<'quote_items'>
export type Payment = Tables<'payments'>
export type PaymentLink = Tables<'payment_links'>
export type PaymentReminder = Tables<'payment_reminders'>
export type Receipt = Tables<'receipts'>
export type Document = Tables<'documents'>
export type Settings = Tables<'settings'>
export type MenuForm = Tables<'menu_forms'>
export type MenuFormField = Tables<'menu_form_fields'>
export type MenuFormResponse = Tables<'menu_form_responses'>
export type BookingMenuForm = Tables<'booking_menu_forms'>
export type ActivityLog = Tables<'activity_logs'>
export type Product = Tables<'products'>
export type Package = Tables<'packages'>
export type EmailLog = Tables<'email_logs'>

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
