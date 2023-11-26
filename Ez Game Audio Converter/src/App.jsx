import {
  createBrowserRouter,
  createHashRouter,
  createMemoryRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import React, { Suspense } from "react";
import { AppShell, Loader, MantineProvider, Title, } from "@mantine/core";
//import { Router } from './Router';
import { theme } from './theme';

// const StartPage = React.lazy(() => import('./pages/StartPage'));
import HomePage from "./pages/HomePage";
import StartPage from "./pages/StartPage";
import NextPage from "./pages/NextPage";

const MyRoute = ({page:Page}) => {
  return (
    <Suspense fallback={<Loader />}>
      <Page />
    </Suspense>
  )
}


const router = createBrowserRouter([
  { path: '/home', element: <MyRoute page={HomePage}/> },
  { path: '/start', element: <MyRoute page={StartPage}/> },
  { path: '/next', element: <MyRoute page={NextPage}/> },
  {path: '*', element: <Navigate to='/home' replace /> }
], 
 {initialEntries: ['/'], initialIndex:0}
)

function App() {
  return (
    <MantineProvider theme={theme}>

 <AppShell>
  <AppShell.Header>
    <Title order={1} ta='center'>Ez Game Audio Converter</Title>
  </AppShell.Header>
  <AppShell.Main pt={60}>
    <RouterProvider router={router} />
  </AppShell.Main>
 </AppShell>
    </MantineProvider>

  )
};


export default App;
