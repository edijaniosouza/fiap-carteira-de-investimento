import { base_api } from "@/store/api/base_api";
import type {
  ForgotPasswordRequest,
  MessageResponse,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
  UpdateProfileRequest,
  UserDto,
} from "@/types/api";

// Endpoint names stay camelCase: RTK Query derives hook names (useSignInMutation) from them.
export const auth_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    signUp: build.mutation<UserDto, SignUpRequest>({
      query: (body) => ({ url: "/auth/sign_up", method: "POST", body }),
    }),
    signIn: build.mutation<UserDto, SignInRequest>({
      query: (body) => ({ url: "/auth/sign_in", method: "POST", body }),
    }),
    signOut: build.mutation<void, void>({
      query: () => ({ url: "/auth/sign_out", method: "POST" }),
    }),
    forgotPassword: build.mutation<MessageResponse, ForgotPasswordRequest>({
      query: (body) => ({ url: "/auth/forgot_password", method: "POST", body }),
    }),
    resetPassword: build.mutation<MessageResponse, ResetPasswordRequest>({
      query: (body) => ({ url: "/auth/reset_password", method: "POST", body }),
    }),
    getProfile: build.query<UserDto, void>({
      query: () => "/auth/profile",
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<UserDto, UpdateProfileRequest>({
      query: (body) => ({ url: "/auth/profile", method: "PATCH", body }),
      invalidatesTags: ["Profile"],
    }),
  }),
});

export const {
  useSignUpMutation,
  useSignInMutation,
  useSignOutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} = auth_api;
