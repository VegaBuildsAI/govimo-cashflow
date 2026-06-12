import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import Alertas from "./pages/Alertas";
import Calendario from "./pages/Calendario";
import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "forecast", element: <Forecast /> },
      { path: "calendario", element: <Calendario /> },
      { path: "alertas", element: <Alertas /> },
    ],
  },
]);
