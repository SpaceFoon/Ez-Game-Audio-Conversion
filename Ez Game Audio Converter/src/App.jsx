//App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from './Pages/HomePage'
import Input from './Pages/Input'
import Output from './Pages/Output'
import Finished from './Pages/Finished'
export default function App() {
   return (
<BrowserRouter>
        <><h1>EZ Game Audio Converter</h1></>
    <Routes>
        <Route path ='/' element={<HomePage />} />
        <Route path ='HomePage' element={<HomePage />} />
        <Route path="/Input" element={<Input />} />
        <Route path="/Output" element={<Output />} />
        <Route path="/Finished" element={<Finished/>} />
      </Routes>
    </BrowserRouter>
  );
}
