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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acknowledgments: {
        Row: {
          document_id: string
          id: string
          signed_at: string
          signed_name: string | null
          tenant_id: string
          user_id: string
          version_label: string
        }
        Insert: {
          document_id: string
          id?: string
          signed_at?: string
          signed_name?: string | null
          tenant_id: string
          user_id: string
          version_label: string
        }
        Update: {
          document_id?: string
          id?: string
          signed_at?: string
          signed_name?: string | null
          tenant_id?: string
          user_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_catalog: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          name: string
          plans: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name: string
          plans?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name?: string
          plans?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      approval_delegations: {
        Row: {
          active: boolean
          created_at: string
          delegate_user_id: string
          delegator_user_id: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          delegate_user_id: string
          delegator_user_id: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          delegate_user_id?: string
          delegator_user_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      approval_rules: {
        Row: {
          active: boolean
          approver_user_ids: string[]
          created_at: string
          created_by: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id: string
          max_amount: number | null
          min_amount: number
          mode: string
          name: string
          priority: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          approver_user_ids?: string[]
          created_at?: string
          created_by?: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id?: string
          max_amount?: number | null
          min_amount?: number
          mode?: string
          name: string
          priority?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          approver_user_ids?: string[]
          created_at?: string
          created_by?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          id?: string
          max_amount?: number | null
          min_amount?: number
          mode?: string
          name?: string
          priority?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          created_at: string
          decided_at: string | null
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id: string
          note: string | null
          role: string | null
          sequence_no: number
          status: Database["public"]["Enums"]["approval_status"]
          tenant_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          created_at?: string
          decided_at?: string | null
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id?: string
          note?: string | null
          role?: string | null
          sequence_no?: number
          status?: Database["public"]["Enums"]["approval_status"]
          tenant_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          created_at?: string
          decided_at?: string | null
          doc_id?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          id?: string
          note?: string | null
          role?: string | null
          sequence_no?: number
          status?: Database["public"]["Enums"]["approval_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          ack_required: boolean
          assigned_by: string | null
          created_at: string
          document_id: string
          due_date: string | null
          id: string
          target_id: string
          target_type: string
          tenant_id: string
        }
        Insert: {
          ack_required?: boolean
          assigned_by?: string | null
          created_at?: string
          document_id: string
          due_date?: string | null
          id?: string
          target_id: string
          target_type: string
          tenant_id: string
        }
        Update: {
          ack_required?: boolean
          assigned_by?: string | null
          created_at?: string
          document_id?: string
          due_date?: string | null
          id?: string
          target_id?: string
          target_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          app_code: string | null
          created_at: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          filename: string | null
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime: string | null
          size: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          app_code?: string | null
          created_at?: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime?: string | null
          size?: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          app_code?: string | null
          created_at?: string
          doc_id?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime?: string | null
          size?: number | null
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_app_code_fkey"
            columns: ["app_code"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          app_code: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          note: string | null
          old_value: Json | null
          record_id: string | null
          record_type: string
          tenant_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          app_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          record_id?: string | null
          record_type: string
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          app_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          record_id?: string | null
          record_type?: string
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_app_code_fkey"
            columns: ["app_code"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_usd: number
          bill_date: string
          bill_no: string
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          due_date: string | null
          id: string
          note: string | null
          party_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          tenant_id: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          amount_usd?: number
          bill_date?: string
          bill_no: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          party_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          amount_usd?: number
          bill_date?: string
          bill_no?: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          party_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          document_id: string
          id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          bundle_id: string
          document_id: string
          id?: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          bundle_id?: string
          document_id?: string
          id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "document_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          sort_order: number
          symbol: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          sort_order?: number
          symbol?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          sort_order?: number
          symbol?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_bundles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_lines: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id: string
          note: string | null
          sort_order: number
          tag_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id?: string
          note?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          doc_id?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          id?: string
          note?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lines_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          author_id: string | null
          created_at: string
          document_id: string
          id: string
          snapshot: Json
          tenant_id: string
          version_label: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          snapshot?: Json
          tenant_id: string
          version_label: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          snapshot?: Json
          tenant_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          current_version: string
          doc_no: string | null
          doc_type: string
          id: string
          owner_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: string
          doc_no?: string | null
          doc_type?: string
          id?: string
          owner_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: string
          doc_no?: string | null
          doc_type?: string
          id?: string
          owner_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_usd: number
          anomaly_checked_at: string | null
          anomaly_flags: Json | null
          anomaly_score: number | null
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          expense_date: string
          expense_no: string
          fee: number
          id: string
          note: string | null
          party_id: string | null
          payment_account_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["doc_status"]
          tenant_id: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          amount_usd?: number
          anomaly_checked_at?: string | null
          anomaly_flags?: Json | null
          anomaly_score?: number | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          expense_date?: string
          expense_no: string
          fee?: number
          id?: string
          note?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          amount_usd?: number
          anomaly_checked_at?: string | null
          anomaly_flags?: Json | null
          anomaly_score?: number | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          expense_date?: string
          expense_no?: string
          fee?: number
          id?: string
          note?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_usd: number
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_no: string
          note: string | null
          paid_amount_usd: number
          party_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at: string
          viewed_at: string | null
          void_reason: string | null
        }
        Insert: {
          amount_usd?: number
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no: string
          note?: string | null
          paid_amount_usd?: number
          party_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at?: string
          viewed_at?: string | null
          void_reason?: string | null
        }
        Update: {
          amount_usd?: number
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          note?: string | null
          paid_amount_usd?: number
          party_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
          updated_at?: string
          viewed_at?: string | null
          void_reason?: string | null
        }
        Relationships: []
      }
      manual_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          description: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          entered_by: string | null
          id: string
          mtx_no: string
          note: string | null
          party_id: string | null
          payment_account_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["manual_txn_status"]
          tenant_id: string
          txn_date: string
          updated_at: string
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          entered_by?: string | null
          id?: string
          mtx_no: string
          note?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["manual_txn_status"]
          tenant_id: string
          txn_date?: string
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["txn_direction"]
          entered_by?: string | null
          id?: string
          mtx_no?: string
          note?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["manual_txn_status"]
          tenant_id?: string
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_transactions_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          app_code: string | null
          body: string | null
          channel: string
          created_at: string
          id: string
          kind: string
          link_path: string | null
          payload: Json | null
          read_at: string | null
          tenant_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          app_code?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          kind: string
          link_path?: string | null
          payload?: Json | null
          read_at?: string | null
          tenant_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          app_code?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          payload?: Json | null
          read_at?: string | null
          tenant_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_app_code_fkey"
            columns: ["app_code"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      numbering_sequences: {
        Row: {
          counter: number
          doc_type: string
          tenant_id: string
          year: number
        }
        Insert: {
          counter?: number
          doc_type: string
          tenant_id: string
          year: number
        }
        Update: {
          counter?: number
          doc_type?: string
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "numbering_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          active: boolean
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string | null
          default_category_id: string | null
          default_currency: string | null
          default_payment_method: string | null
          default_payment_terms: string | null
          id: string
          internal_notes: string | null
          is_1099_vendor: boolean
          is_customer: boolean
          is_payee: boolean
          is_payer: boolean
          is_vendor: boolean
          legal_address: string | null
          linked_user_id: string | null
          name_en: string
          nick_name: string | null
          payee_type: string | null
          portal_invited_at: string | null
          portal_last_invitation_sent_at: string | null
          portal_last_login_at: string | null
          portal_status: Database["public"]["Enums"]["party_portal_status"]
          postal_code: string | null
          source_app: string | null
          state: string | null
          tag: string | null
          tax_form_type: string | null
          tax_id: string | null
          tenant_id: string
          updated_at: string
          w9_attachment_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_category_id?: string | null
          default_currency?: string | null
          default_payment_method?: string | null
          default_payment_terms?: string | null
          id?: string
          internal_notes?: string | null
          is_1099_vendor?: boolean
          is_customer?: boolean
          is_payee?: boolean
          is_payer?: boolean
          is_vendor?: boolean
          legal_address?: string | null
          linked_user_id?: string | null
          name_en: string
          nick_name?: string | null
          payee_type?: string | null
          portal_invited_at?: string | null
          portal_last_invitation_sent_at?: string | null
          portal_last_login_at?: string | null
          portal_status?: Database["public"]["Enums"]["party_portal_status"]
          postal_code?: string | null
          source_app?: string | null
          state?: string | null
          tag?: string | null
          tax_form_type?: string | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
          w9_attachment_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_category_id?: string | null
          default_currency?: string | null
          default_payment_method?: string | null
          default_payment_terms?: string | null
          id?: string
          internal_notes?: string | null
          is_1099_vendor?: boolean
          is_customer?: boolean
          is_payee?: boolean
          is_payer?: boolean
          is_vendor?: boolean
          legal_address?: string | null
          linked_user_id?: string | null
          name_en?: string
          nick_name?: string | null
          payee_type?: string | null
          portal_invited_at?: string | null
          portal_last_invitation_sent_at?: string | null
          portal_last_login_at?: string | null
          portal_status?: Database["public"]["Enums"]["party_portal_status"]
          postal_code?: string | null
          source_app?: string | null
          state?: string | null
          tag?: string | null
          tax_form_type?: string | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
          w9_attachment_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_source_app_fkey"
            columns: ["source_app"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      party_bank_accounts: {
        Row: {
          account_last4: string | null
          account_number: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          bank_addr_city: string | null
          bank_addr_line1: string | null
          bank_addr_line2: string | null
          bank_addr_state: string | null
          bank_addr_zip: string | null
          bank_address: string | null
          bank_name: string | null
          bank_phone: string | null
          created_at: string
          id: string
          party_id: string
          replaced_by_id: string | null
          routing_number: string | null
          routing_type: Database["public"]["Enums"]["routing_type"] | null
          swift: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_last4?: string | null
          account_number?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          bank_addr_city?: string | null
          bank_addr_line1?: string | null
          bank_addr_line2?: string | null
          bank_addr_state?: string | null
          bank_addr_zip?: string | null
          bank_address?: string | null
          bank_name?: string | null
          bank_phone?: string | null
          created_at?: string
          id?: string
          party_id: string
          replaced_by_id?: string | null
          routing_number?: string | null
          routing_type?: Database["public"]["Enums"]["routing_type"] | null
          swift?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_last4?: string | null
          account_number?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          bank_addr_city?: string | null
          bank_addr_line1?: string | null
          bank_addr_line2?: string | null
          bank_addr_state?: string | null
          bank_addr_zip?: string | null
          bank_address?: string | null
          bank_name?: string | null
          bank_phone?: string | null
          created_at?: string
          id?: string
          party_id?: string
          replaced_by_id?: string | null
          routing_number?: string | null
          routing_type?: Database["public"]["Enums"]["routing_type"] | null
          swift?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_bank_accounts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_bank_accounts_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "party_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      party_contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          invited_at: string | null
          is_primary: boolean
          linked_user_id: string | null
          name: string
          party_id: string
          phone: string | null
          role_note: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          is_primary?: boolean
          linked_user_id?: string | null
          name: string
          party_id: string
          phone?: string | null
          role_note?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          is_primary?: boolean
          linked_user_id?: string | null
          name?: string
          party_id?: string
          phone?: string | null
          role_note?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_contacts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          account_name: string
          account_type: Database["public"]["Enums"]["payment_account_type"]
          active: boolean
          bank_feed_source:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          current_balance: number | null
          description: string | null
          external_account_id: string | null
          external_provider: string | null
          id: string
          last_synced_at: string | null
          last4: string | null
          opening_balance: number | null
          plaid_account_id: string | null
          plaid_item_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_type?: Database["public"]["Enums"]["payment_account_type"]
          active?: boolean
          bank_feed_source?:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          description?: string | null
          external_account_id?: string | null
          external_provider?: string | null
          id?: string
          last_synced_at?: string | null
          last4?: string | null
          opening_balance?: number | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_type?: Database["public"]["Enums"]["payment_account_type"]
          active?: boolean
          bank_feed_source?:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          description?: string | null
          external_account_id?: string | null
          external_provider?: string | null
          id?: string
          last_synced_at?: string | null
          last4?: string | null
          opening_balance?: number | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          id: string
          label: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          label: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          label?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          addr_city: string | null
          addr_line1: string | null
          addr_line2: string | null
          addr_state: string | null
          addr_zip: string | null
          amount_usd: number
          cancel_reason: string | null
          created_at: string
          currency: string
          detail: string | null
          due_date: string | null
          finance_reviewed_at: string | null
          finance_reviewed_by: string | null
          id: string
          note: string | null
          party_bank_account_id: string | null
          party_id: string | null
          payment_method: string | null
          payment_method_other: string | null
          priority: string
          reimbursement: boolean | null
          request_date: string
          request_no: string
          requester_name: string | null
          requester_signature_url: string | null
          scope: string
          signature_active: boolean
          signature_date: string | null
          signature_inactivated_at: string | null
          signature_inactivated_by: string | null
          signature_inactive_reason: string | null
          status: Database["public"]["Enums"]["doc_status"]
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          addr_city?: string | null
          addr_line1?: string | null
          addr_line2?: string | null
          addr_state?: string | null
          addr_zip?: string | null
          amount_usd?: number
          cancel_reason?: string | null
          created_at?: string
          currency?: string
          detail?: string | null
          due_date?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          id?: string
          note?: string | null
          party_bank_account_id?: string | null
          party_id?: string | null
          payment_method?: string | null
          payment_method_other?: string | null
          priority?: string
          reimbursement?: boolean | null
          request_date?: string
          request_no: string
          requester_name?: string | null
          requester_signature_url?: string | null
          scope?: string
          signature_active?: boolean
          signature_date?: string | null
          signature_inactivated_at?: string | null
          signature_inactivated_by?: string | null
          signature_inactive_reason?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          addr_city?: string | null
          addr_line1?: string | null
          addr_line2?: string | null
          addr_state?: string | null
          addr_zip?: string | null
          amount_usd?: number
          cancel_reason?: string | null
          created_at?: string
          currency?: string
          detail?: string | null
          due_date?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          id?: string
          note?: string | null
          party_bank_account_id?: string | null
          party_id?: string | null
          payment_method?: string | null
          payment_method_other?: string | null
          priority?: string
          reimbursement?: boolean | null
          request_date?: string
          request_no?: string
          requester_name?: string | null
          requester_signature_url?: string | null
          scope?: string
          signature_active?: boolean
          signature_date?: string | null
          signature_inactivated_at?: string | null
          signature_inactivated_by?: string | null
          signature_inactive_reason?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_party_bank_account_id_fkey"
            columns: ["party_bank_account_id"]
            isOneToOne: false
            referencedRelation: "party_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_last4_snapshot: string | null
          account_type_snapshot: string | null
          bank_name_snapshot: string | null
          created_at: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          fee: number | null
          id: string
          method: string
          note: string | null
          paid_by: string
          payment_account_id: string | null
          payment_account_nickname: string | null
          payment_date: string
          payment_method_snapshot: string | null
          proof_attachment_id: string | null
          routing_last4_snapshot: string | null
          tenant_id: string
          vendor_bank_account_id: string | null
        }
        Insert: {
          account_last4_snapshot?: string | null
          account_type_snapshot?: string | null
          bank_name_snapshot?: string | null
          created_at?: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          fee?: number | null
          id?: string
          method: string
          note?: string | null
          paid_by: string
          payment_account_id?: string | null
          payment_account_nickname?: string | null
          payment_date?: string
          payment_method_snapshot?: string | null
          proof_attachment_id?: string | null
          routing_last4_snapshot?: string | null
          tenant_id: string
          vendor_bank_account_id?: string | null
        }
        Update: {
          account_last4_snapshot?: string | null
          account_type_snapshot?: string | null
          bank_name_snapshot?: string | null
          created_at?: string
          doc_id?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          fee?: number | null
          id?: string
          method?: string
          note?: string | null
          paid_by?: string
          payment_account_id?: string | null
          payment_account_nickname?: string | null
          payment_date?: string
          payment_method_snapshot?: string | null
          proof_attachment_id?: string | null
          routing_last4_snapshot?: string | null
          tenant_id?: string
          vendor_bank_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_proof_attachment_id_fkey"
            columns: ["proof_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_bank_account_id_fkey"
            columns: ["vendor_bank_account_id"]
            isOneToOne: false
            referencedRelation: "vendor_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      process_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id: string
          internal_only: boolean
          notify_user_ids: string[] | null
          tenant_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          doc_id: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          id?: string
          internal_only?: boolean
          notify_user_ids?: string[] | null
          tenant_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          doc_id?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          id?: string
          internal_only?: boolean
          notify_user_ids?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          display_name: string | null
          id: string
          position_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          id: string
          position_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          id?: string
          position_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_runs: {
        Row: {
          doc_id: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"] | null
          error: string | null
          id: string
          ran_at: string
          run_for_date: string
          schedule_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          doc_id?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"] | null
          error?: string | null
          id?: string
          ran_at?: string
          run_for_date: string
          schedule_id: string
          status: string
          tenant_id: string
        }
        Update: {
          doc_id?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"] | null
          error?: string | null
          id?: string
          ran_at?: string
          run_for_date?: string
          schedule_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          active: boolean
          amount_usd: number
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          detail: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          due_offset_days: number
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          last_run_date: string | null
          lines: Json
          name: string
          next_run_date: string
          note: string | null
          party_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          detail?: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          due_offset_days?: number
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_run_date?: string | null
          lines?: Json
          name: string
          next_run_date: string
          note?: string | null
          party_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          detail?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          due_offset_days?: number
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_run_date?: string | null
          lines?: Json
          name?: string
          next_run_date?: string
          note?: string | null
          party_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_kv: {
        Row: {
          key: string
          tenant_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          tenant_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          tenant_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_kv_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_apps: {
        Row: {
          activated_at: string
          app_code: string
          canceled_at: string | null
          created_at: string
          deletion_scheduled_at: string | null
          id: string
          plan: string
          renews_at: string | null
          seats: number | null
          settings: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          app_code: string
          canceled_at?: string | null
          created_at?: string
          deletion_scheduled_at?: string | null
          id?: string
          plan?: string
          renews_at?: string | null
          seats?: number | null
          settings?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          app_code?: string
          canceled_at?: string | null
          created_at?: string
          deletion_scheduled_at?: string | null
          id?: string
          plan?: string
          renews_at?: string | null
          seats?: number | null
          settings?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_apps_app_code_fkey"
            columns: ["app_code"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenant_apps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          invited_at: string | null
          joined_at: string | null
          portal: Database["public"]["Enums"]["portal_type"]
          position: string | null
          status: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          portal?: Database["public"]["Enums"]["portal_type"]
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          portal?: Database["public"]["Enums"]["portal_type"]
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          plan_renews_at: string | null
          plan_seats: number | null
          plan_status: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          plan_renews_at?: string | null
          plan_seats?: number | null
          plan_status?: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          plan_renews_at?: string | null
          plan_seats?: number | null
          plan_status?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_for_bill: boolean | null
          default_for_expense: boolean | null
          default_for_manual_transaction: boolean | null
          default_for_payment_request: boolean | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          tenant_id: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_for_bill?: boolean | null
          default_for_expense?: boolean | null
          default_for_manual_transaction?: boolean | null
          default_for_payment_request?: boolean | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          tenant_id: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_for_bill?: boolean | null
          default_for_expense?: boolean | null
          default_for_manual_transaction?: boolean | null
          default_for_payment_request?: boolean | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_lines: {
        Row: {
          amount: number
          category_id: string | null
          description: string | null
          id: string
          note: string | null
          sort_order: number
          tag_id: string | null
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          description?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          description?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          bank_feed_source:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          category_id: string | null
          cleared: boolean
          cleared_date: string | null
          correction_of_txn_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          fee: number
          id: string
          match_status: Database["public"]["Enums"]["match_status_type"] | null
          matched_bank_txn_id: string | null
          paid_by: string | null
          party_id: string | null
          payment_account_id: string | null
          payment_method: string | null
          reconciled: boolean
          reconciled_date: string | null
          source_id: string | null
          source_kind: Database["public"]["Enums"]["doc_kind"] | null
          statement_period: string | null
          status: string
          tenant_id: string
          txn_date: string
          txn_no: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          amount: number
          bank_feed_source?:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          category_id?: string | null
          cleared?: boolean
          cleared_date?: string | null
          correction_of_txn_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          fee?: number
          id?: string
          match_status?: Database["public"]["Enums"]["match_status_type"] | null
          matched_bank_txn_id?: string | null
          paid_by?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          reconciled?: boolean
          reconciled_date?: string | null
          source_id?: string | null
          source_kind?: Database["public"]["Enums"]["doc_kind"] | null
          statement_period?: string | null
          status?: string
          tenant_id: string
          txn_date?: string
          txn_no: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          amount?: number
          bank_feed_source?:
            | Database["public"]["Enums"]["bank_feed_source_type"]
            | null
          category_id?: string | null
          cleared?: boolean
          cleared_date?: string | null
          correction_of_txn_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["txn_direction"]
          fee?: number
          id?: string
          match_status?: Database["public"]["Enums"]["match_status_type"] | null
          matched_bank_txn_id?: string | null
          paid_by?: string | null
          party_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          reconciled?: boolean
          reconciled_date?: string | null
          source_id?: string | null
          source_kind?: Database["public"]["Enums"]["doc_kind"] | null
          statement_period?: string | null
          status?: string
          tenant_id?: string
          txn_date?: string
          txn_no?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_correction_of_txn_id_fkey"
            columns: ["correction_of_txn_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          app_code: string
          created_at: string
          custom_role_key: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          app_code?: string
          created_at?: string
          custom_role_key?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          app_code?: string
          created_at?: string
          custom_role_key?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_app_code_fkey"
            columns: ["app_code"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bank_accounts: {
        Row: {
          account_holder_name: string
          account_last4: string
          account_type: string
          approved_at: string | null
          approved_by_user_id: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by_user_id: string | null
          bank_name: string
          created_at: string
          created_by_internal_user_id: string | null
          created_by_vendor_user_id: string | null
          has_been_used_for_payment: boolean
          id: string
          is_primary: boolean
          notes: string | null
          provider: string | null
          provider_token: string | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          routing_last4: string | null
          status: Database["public"]["Enums"]["vendor_bank_status"]
          tenant_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_holder_name: string
          account_last4: string
          account_type: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          bank_name: string
          created_at?: string
          created_by_internal_user_id?: string | null
          created_by_vendor_user_id?: string | null
          has_been_used_for_payment?: boolean
          id?: string
          is_primary?: boolean
          notes?: string | null
          provider?: string | null
          provider_token?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          routing_last4?: string | null
          status?: Database["public"]["Enums"]["vendor_bank_status"]
          tenant_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_holder_name?: string
          account_last4?: string
          account_type?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          bank_name?: string
          created_at?: string
          created_by_internal_user_id?: string | null
          created_by_vendor_user_id?: string | null
          has_been_used_for_payment?: boolean
          id?: string
          is_primary?: boolean
          notes?: string | null
          provider?: string | null
          provider_token?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          routing_last4?: string | null
          status?: Database["public"]["Enums"]["vendor_bank_status"]
          tenant_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bank_accounts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bank_audit_logs: {
        Row: {
          action: string
          actor_type: Database["public"]["Enums"]["vendor_audit_actor"]
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_value_masked: Json | null
          old_value_masked: Json | null
          tenant_id: string
          user_agent: string | null
          vendor_id: string
        }
        Insert: {
          action: string
          actor_type: Database["public"]["Enums"]["vendor_audit_actor"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value_masked?: Json | null
          old_value_masked?: Json | null
          tenant_id: string
          user_agent?: string | null
          vendor_id: string
        }
        Update: {
          action?: string
          actor_type?: Database["public"]["Enums"]["vendor_audit_actor"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value_masked?: Json | null
          old_value_masked?: Json | null
          tenant_id?: string
          user_agent?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bank_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bank_audit_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_intake_links: {
        Row: {
          app_code: string
          captcha_required: boolean
          created_at: string
          created_by: string | null
          disabled_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_submission_at: string | null
          regenerated_at: string | null
          slug: string | null
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          app_code?: string
          captcha_required?: boolean
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_submission_at?: string | null
          regenerated_at?: string | null
          slug?: string | null
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          app_code?: string
          captcha_required?: boolean
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_submission_at?: string | null
          regenerated_at?: string | null
          slug?: string | null
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_intake_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_intake_submissions: {
        Row: {
          account_encrypted: string | null
          account_last4: string | null
          amount: number | null
          app_code: string
          bank_account_holder: string | null
          bank_account_type: string | null
          bank_certified: boolean
          bank_name: string | null
          business_address: Json | null
          category_id: string | null
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_bank_account_id: string | null
          created_payment_request_id: string | null
          created_vendor_id: string | null
          currency: string
          display_name: string | null
          due_date: string | null
          duplicate_of_submission_id: string | null
          id: string
          intake_link_id: string | null
          invoice_date: string | null
          invoice_reference_number: string | null
          ip_address: unknown
          legal_business_name: string
          mailing_address: Json | null
          matched_vendor_id: string | null
          notes: string | null
          payment_description: string | null
          payment_method_preference: string | null
          rejection_reason: string | null
          related_project: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision_message: string | null
          routing_encrypted: string | null
          routing_last4: string | null
          signature_storage_path: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          status: Database["public"]["Enums"]["vendor_intake_status"]
          tax_certified: boolean
          tax_classification: string | null
          tax_id_last4: string | null
          tenant_id: string
          updated_at: string
          user_agent: string | null
          vendor_type: string | null
          website: string | null
        }
        Insert: {
          account_encrypted?: string | null
          account_last4?: string | null
          amount?: number | null
          app_code?: string
          bank_account_holder?: string | null
          bank_account_type?: string | null
          bank_certified?: boolean
          bank_name?: string | null
          business_address?: Json | null
          category_id?: string | null
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_bank_account_id?: string | null
          created_payment_request_id?: string | null
          created_vendor_id?: string | null
          currency?: string
          display_name?: string | null
          due_date?: string | null
          duplicate_of_submission_id?: string | null
          id?: string
          intake_link_id?: string | null
          invoice_date?: string | null
          invoice_reference_number?: string | null
          ip_address?: unknown
          legal_business_name: string
          mailing_address?: Json | null
          matched_vendor_id?: string | null
          notes?: string | null
          payment_description?: string | null
          payment_method_preference?: string | null
          rejection_reason?: string | null
          related_project?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_message?: string | null
          routing_encrypted?: string | null
          routing_last4?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["vendor_intake_status"]
          tax_certified?: boolean
          tax_classification?: string | null
          tax_id_last4?: string | null
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          vendor_type?: string | null
          website?: string | null
        }
        Update: {
          account_encrypted?: string | null
          account_last4?: string | null
          amount?: number | null
          app_code?: string
          bank_account_holder?: string | null
          bank_account_type?: string | null
          bank_certified?: boolean
          bank_name?: string | null
          business_address?: Json | null
          category_id?: string | null
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_bank_account_id?: string | null
          created_payment_request_id?: string | null
          created_vendor_id?: string | null
          currency?: string
          display_name?: string | null
          due_date?: string | null
          duplicate_of_submission_id?: string | null
          id?: string
          intake_link_id?: string | null
          invoice_date?: string | null
          invoice_reference_number?: string | null
          ip_address?: unknown
          legal_business_name?: string
          mailing_address?: Json | null
          matched_vendor_id?: string | null
          notes?: string | null
          payment_description?: string | null
          payment_method_preference?: string | null
          rejection_reason?: string | null
          related_project?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_message?: string | null
          routing_encrypted?: string | null
          routing_last4?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["vendor_intake_status"]
          tax_certified?: boolean
          tax_classification?: string | null
          tax_id_last4?: string | null
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          vendor_type?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_intake_submissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_created_bank_account_id_fkey"
            columns: ["created_bank_account_id"]
            isOneToOne: false
            referencedRelation: "vendor_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_created_payment_request_id_fkey"
            columns: ["created_payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_created_vendor_id_fkey"
            columns: ["created_vendor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_duplicate_of_submission_id_fkey"
            columns: ["duplicate_of_submission_id"]
            isOneToOne: false
            referencedRelation: "vendor_intake_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_intake_link_id_fkey"
            columns: ["intake_link_id"]
            isOneToOne: false
            referencedRelation: "vendor_intake_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_matched_vendor_id_fkey"
            columns: ["matched_vendor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_intake_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          comment: string | null
          created_at: string
          email: string
          id: string
          locale: string | null
          name: string
          source: string | null
          user_agent: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          email: string
          id?: string
          locale?: string | null
          name: string
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string | null
          name?: string
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      approval_requests_v: {
        Row: {
          created_at: string | null
          current_step: number | null
          decided_at: string | null
          id: string | null
          metadata: Json | null
          requested_at: string | null
          requested_by: string | null
          source_app: string | null
          status: string | null
          subject_id: string | null
          subject_type: string | null
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          current_step?: number | null
          decided_at?: string | null
          id?: string | null
          metadata?: Json | null
          requested_at?: string | null
          requested_by?: string | null
          source_app?: string | null
          status?: string | null
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: number | null
          decided_at?: string | null
          id?: string | null
          metadata?: Json | null
          requested_at?: string | null
          requested_by?: string | null
          source_app?: string | null
          status?: string | null
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_delegation: {
        Args: { _tenant: string; _user: string }
        Returns: string
      }
      cleanup_expired_tenant_apps: { Args: never; Returns: number }
      create_tenant_for_self: {
        Args: {
          _display_name?: string
          _email?: string
          _name: string
          _slug: string
        }
        Returns: {
          created_at: string
          id: string
          name: string
          plan: string
          plan_renews_at: string | null
          plan_seats: number | null
          plan_status: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant: string
          _user: string
        }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _tenant: string
              _user: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _app_code: string
              _role: Database["public"]["Enums"]["app_role"]
              _tenant: string
              _user: string
            }
            Returns: boolean
          }
      has_role_in_app: {
        Args: { _app_code: string; _tenant: string; _user: string }
        Returns: boolean
      }
      is_internal_staff: {
        Args: { _tenant: string; _user: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant: string; _user: string }
        Returns: boolean
      }
      next_doc_number: {
        Args: { _doc_type: string; _tenant: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tenant_has_app: {
        Args: { _app_code: string; _tenant: string }
        Returns: boolean
      }
      user_can_view_doc: {
        Args: {
          _doc_id: string
          _doc_kind: Database["public"]["Enums"]["doc_kind"]
          _tenant: string
          _user: string
        }
        Returns: boolean
      }
      user_has_app: {
        Args: { _app_code: string; _tenant: string; _user: string }
        Returns: boolean
      }
      user_has_party_access: {
        Args: { _party: string; _user: string }
        Returns: boolean
      }
      user_portal: {
        Args: { _tenant: string; _user: string }
        Returns: Database["public"]["Enums"]["portal_type"]
      }
      users_share_tenant: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "super_admin"
        | "finance_ap"
        | "finance_ar"
        | "finance_manager"
        | "accountant"
        | "approver"
        | "vendor"
        | "customer"
        | "sop_admin"
        | "sop_author"
        | "sop_reviewer"
        | "sop_operator"
      approval_status:
        | "pending"
        | "approved"
        | "pending_reason"
        | "rejected"
        | "skipped"
      attachment_kind:
        | "invoice"
        | "receipt"
        | "contract"
        | "payment_proof"
        | "signature"
        | "support"
        | "other"
        | "w9"
        | "voided_check"
      bank_feed_source_type: "manual" | "plaid" | "csv"
      category_type:
        | "income"
        | "cogs"
        | "expense"
        | "asset"
        | "liability"
        | "equity"
        | "other_income"
        | "other_expense"
      doc_kind:
        | "payment_request"
        | "bill"
        | "expense"
        | "manual_transaction"
        | "transaction"
        | "invoice"
        | "party"
        | "vendor_intake_submission"
      doc_status:
        | "draft"
        | "submitted"
        | "finance_review"
        | "pending_vendor_clarification"
        | "finance_approved"
        | "approval_pending"
        | "partially_approved"
        | "pending_by_approver"
        | "rejected"
        | "fully_approved"
        | "payment_processing"
        | "paid"
        | "recorded"
        | "cancelled"
        | "void"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
        | "cancelled"
      manual_txn_status:
        | "entered"
        | "post_approval_pending"
        | "approved"
        | "rejected"
        | "recorded"
        | "void"
      match_status_type: "unmatched" | "suggested" | "matched" | "ignored"
      party_portal_status: "not_invited" | "invited" | "active" | "disabled"
      payment_account_type:
        | "checking"
        | "savings"
        | "credit_card"
        | "cash"
        | "other"
      portal_type: "internal" | "vendor" | "approver" | "customer"
      recurring_frequency: "weekly" | "monthly"
      routing_type: "ach" | "direct_deposit" | "wire"
      txn_direction: "in" | "out"
      user_status: "invited" | "active" | "suspended" | "inactive"
      vendor_audit_actor: "vendor_user" | "internal_user" | "system"
      vendor_bank_status:
        | "draft"
        | "pending_review"
        | "active"
        | "rejected"
        | "archived"
      vendor_intake_status:
        | "submitted"
        | "under_review"
        | "revision_requested"
        | "approved"
        | "rejected"
        | "duplicate"
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
    Enums: {
      app_role: [
        "owner",
        "super_admin",
        "finance_ap",
        "finance_ar",
        "finance_manager",
        "accountant",
        "approver",
        "vendor",
        "customer",
        "sop_admin",
        "sop_author",
        "sop_reviewer",
        "sop_operator",
      ],
      approval_status: [
        "pending",
        "approved",
        "pending_reason",
        "rejected",
        "skipped",
      ],
      attachment_kind: [
        "invoice",
        "receipt",
        "contract",
        "payment_proof",
        "signature",
        "support",
        "other",
        "w9",
        "voided_check",
      ],
      bank_feed_source_type: ["manual", "plaid", "csv"],
      category_type: [
        "income",
        "cogs",
        "expense",
        "asset",
        "liability",
        "equity",
        "other_income",
        "other_expense",
      ],
      doc_kind: [
        "payment_request",
        "bill",
        "expense",
        "manual_transaction",
        "transaction",
        "invoice",
        "party",
        "vendor_intake_submission",
      ],
      doc_status: [
        "draft",
        "submitted",
        "finance_review",
        "pending_vendor_clarification",
        "finance_approved",
        "approval_pending",
        "partially_approved",
        "pending_by_approver",
        "rejected",
        "fully_approved",
        "payment_processing",
        "paid",
        "recorded",
        "cancelled",
        "void",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "partially_paid",
        "paid",
        "overdue",
        "void",
        "cancelled",
      ],
      manual_txn_status: [
        "entered",
        "post_approval_pending",
        "approved",
        "rejected",
        "recorded",
        "void",
      ],
      match_status_type: ["unmatched", "suggested", "matched", "ignored"],
      party_portal_status: ["not_invited", "invited", "active", "disabled"],
      payment_account_type: [
        "checking",
        "savings",
        "credit_card",
        "cash",
        "other",
      ],
      portal_type: ["internal", "vendor", "approver", "customer"],
      recurring_frequency: ["weekly", "monthly"],
      routing_type: ["ach", "direct_deposit", "wire"],
      txn_direction: ["in", "out"],
      user_status: ["invited", "active", "suspended", "inactive"],
      vendor_audit_actor: ["vendor_user", "internal_user", "system"],
      vendor_bank_status: [
        "draft",
        "pending_review",
        "active",
        "rejected",
        "archived",
      ],
      vendor_intake_status: [
        "submitted",
        "under_review",
        "revision_requested",
        "approved",
        "rejected",
        "duplicate",
      ],
    },
  },
} as const
