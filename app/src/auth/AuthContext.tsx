import { createContext, useContext, useState, type ReactNode } from "react";
import {
  authenticateUser,
  restoreSession,
  serializeSession,
  type DemoUser,
} from "./session";

const STORAGE_KEY = "govimo-demo-user";

interface AuthContextValue {
  user: DemoUser | null;
  login: (name: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(() =>
    restoreSession(window.localStorage.getItem(STORAGE_KEY)),
  );

  const login = (name: string, password: string) => {
    const nextUser = authenticateUser(name, password);
    if (!nextUser) return false;
    window.localStorage.setItem(STORAGE_KEY, serializeSession(nextUser));
    setUser(nextUser);
    return true;
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
