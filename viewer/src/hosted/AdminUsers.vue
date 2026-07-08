<template>
  <div class="container py-3 py-md-4" style="max-width: 68rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h3 class="mb-0">User management</h3>
        <div class="text-muted small">Admin-only view of registered users and hosted access.</div>
      </div>
      <a href="?lobby=1" class="btn btn-outline-secondary btn-sm">Back to lobby</a>
    </div>

    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div v-if="!isAdmin" class="alert alert-danger mb-0">Admin only.</div>
    <template v-else>
      <div class="admin-users-toolbar mb-3">
        <b-form-input
          v-model.trim="query"
          type="search"
          placeholder="Filter by name or email"
          autocomplete="off"
          class="admin-users-search"
        />
        <b-button variant="outline-secondary" :disabled="loading" @click="loadUsers">Refresh</b-button>
      </div>

      <div v-if="loading" class="text-muted">Loading users...</div>
      <div v-else-if="filteredUsers.length === 0" class="text-muted">No matching users.</div>
      <div v-else class="table-responsive">
        <table class="table table-sm table-hover admin-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th class="text-center">Seats</th>
              <th class="text-center">Active games</th>
              <th class="text-center">Created</th>
              <th class="text-center">Push</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>
                <div class="font-weight-bold">{{ user.display_name || localPart(user.email) }}</div>
                <div class="text-muted small">{{ user.email }}</div>
              </td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>{{ formatDate(user.last_sign_in_at) }}</td>
              <td class="text-center">
                <div>{{ user.claimed_seats }} claimed</div>
                <div class="text-muted small">{{ user.invited_seats }} invited</div>
              </td>
              <td class="text-center">{{ user.active_games }}</td>
              <td class="text-center">{{ user.games_created }}</td>
              <td class="text-center">{{ user.subscription_count }}</td>
              <td class="text-right">
                <span v-if="isSelf(user)" class="badge badge-secondary">You</span>
                <b-button
                  v-else
                  size="sm"
                  variant="outline-danger"
                  :disabled="deletingUserId === user.id"
                  @click="deleteUser(user)"
                >
                  Delete
                </b-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { isAdminEmail } from "./admin";

type AdminManagedUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  invited_seats: number;
  claimed_seats: number;
  games_created: number;
  active_games: number;
  subscription_count: number;
};

export default Vue.extend({
  name: "HostedAdminUsers",
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      loading: false,
      deletingUserId: "" as string,
      message: "",
      query: "",
      users: [] as AdminManagedUser[],
    };
  },
  computed: {
    isAdmin(): boolean {
      return isAdminEmail((this.session as any).user?.email);
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    filteredUsers(): AdminManagedUser[] {
      const needle = this.query.trim().toLowerCase();
      if (!needle) {
        return this.users;
      }
      return this.users.filter((user) => {
        const haystacks = [user.display_name, user.email, this.localPart(user.email)];
        return haystacks.some((value) => value.toLowerCase().includes(needle));
      });
    },
  },
  created() {
    if (this.isAdmin) {
      this.loadUsers();
    }
  },
  methods: {
    async loadUsers() {
      this.loading = true;
      try {
        const { data, error } = await (this.client as any).functions.invoke("admin-users", {
          body: { action: "list" },
        });
        if (error) {
          throw new Error(error.message);
        }
        this.users = (data?.users ?? []) as AdminManagedUser[];
      } catch (err) {
        this.message = `Could not load users: ${err instanceof Error ? err.message : err}`;
      } finally {
        this.loading = false;
      }
    },
    isSelf(user: AdminManagedUser): boolean {
      return user.id === this.myUserId;
    },
    localPart(email: string): string {
      return email.split("@")[0] ?? email;
    },
    formatDate(value: string | null): string {
      if (!value) {
        return "—";
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    },
    async deleteUser(user: AdminManagedUser) {
      const label = user.display_name || user.email;
      if (
        !window.confirm(
          `Soft-delete ${label}? They will lose future access, but historical games and move logs stay intact.`
        )
      ) {
        return;
      }
      this.deletingUserId = user.id;
      try {
        const { data, error } = await (this.client as any).functions.invoke("admin-users", {
          body: { action: "delete", userId: user.id },
        });
        if (error) {
          throw new Error(error.message);
        }
        this.message = data?.message ?? `Deleted ${label}.`;
        await this.loadUsers();
      } catch (err) {
        this.message = `Could not delete ${label}: ${err instanceof Error ? err.message : err}`;
      } finally {
        this.deletingUserId = "";
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.admin-users-toolbar {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.admin-users-search {
  max-width: 22rem;
}

.admin-users-table {
  th,
  td {
    vertical-align: middle;
  }
}

@media (max-width: 767px) {
  .admin-users-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-users-search {
    max-width: none;
  }
}
</style>
