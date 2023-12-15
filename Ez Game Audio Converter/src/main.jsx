import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from '@mantine/core';
// other css files are required only if
// you are using components from the corresponding package
import '@mantine/core/styles.css';
// import '@mantine/hooks/styles.css';
// import '@mantine/form/styles.css';
// import '@mantine/dates/styles.css';
 import '@mantine/notifications/styles.css';
// import '@mantine/code-highlight/styles.css';
// import '@mantine/tiptap/styles.css';
// import '@mantine/dropzone/styles.css';
// import '@mantine/carousel/styles.css';
// import '@mantine/spotlight/styles.css';
// import '@mantine/modals/styles.css';
// import '@mantine/nprogress/styles.css';

import App from "./App";
import "./styles.css";
import "./App.css";
import "./App.scss";
const theme = createTheme({
  // Your theme override here
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
