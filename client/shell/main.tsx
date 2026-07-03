import React from "react";
import ReactDOM from "react-dom/client";
import { ShellApp } from "../src/shell-app";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(<ShellApp />);
}
