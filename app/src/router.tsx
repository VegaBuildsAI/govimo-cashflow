import { createBrowserRouter } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import Layout from "./components/Layout";
import Alertas from "./pages/Alertas";
import Calendario from "./pages/Calendario";
import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";
import Login from "./pages/Login";
import MLEngine from "./pages/MLEngine";

export const router = createBrowserRouter([
  { path: "login", element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "forecast", element: <Forecast /> },
          { path: "calendario", element: <Calendario /> },
          { path: "alertas", element: <Alertas /> },
          { path: "ml-engine", element: <MLEngine /> },
        ],
      },
    ],
  },
]);
