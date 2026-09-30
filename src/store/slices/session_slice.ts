import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserDto } from "@/types/api";

export type SessionState = {
  current_user: UserDto | null;
};

const initial_state: SessionState = {
  current_user: null,
};

export const session_slice = createSlice({
  name: "session",
  initialState: initial_state,
  reducers: {
    session_started(state, action: PayloadAction<UserDto>) {
      state.current_user = action.payload;
    },
    profile_updated(state, action: PayloadAction<UserDto>) {
      state.current_user = action.payload;
    },
    signed_out(state) {
      state.current_user = null;
    },
  },
  selectors: {
    select_current_user: (state) => state.current_user,
  },
});

export const { session_started, profile_updated, signed_out } = session_slice.actions;
export const { select_current_user } = session_slice.selectors;
