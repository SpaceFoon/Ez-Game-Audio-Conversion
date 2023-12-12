//App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './Pages/Home'
import Working from './Pages/Working'
import Finished from './Pages/Finished'
export default function App() {
   return (
<BrowserRouter>
        <><h1>EZ Game Audio Converter</h1></>
    <Routes>
        <Route path ='/' element={<Home />} />
        <Route path ='Home' element={<Home />}/>
        <Route path="/Working" element={<Working />} />
        <Route path="/Finished" element={<Finished/>} />
      </Routes>
    </BrowserRouter>
  );
}
