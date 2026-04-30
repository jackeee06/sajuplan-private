import { createHashRouter } from "react-router";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import DetailPage from "./components/DetailPage";

export const router = createHashRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/counselor/:id",
    Component: DetailPage,
  },
]);
