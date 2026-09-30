"use client";

import { type ReactNode, useState } from "react";
import { Provider } from "react-redux";
import { make_store } from "@/store/store";
import type { UserDto } from "@/types/api";

type StoreProviderProps = {
  current_user: UserDto | null;
  children: ReactNode;
};

/** Creates the store once per browser session, hydrated with the server-side session. */
export function StoreProvider({ current_user, children }: StoreProviderProps) {
  const [store] = useState(() => make_store({ session: { current_user } }));
  return <Provider store={store}>{children}</Provider>;
}
