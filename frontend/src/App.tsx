import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Clients from './pages/Clients';
import Traffic from './pages/Traffic';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/traffic" element={<Traffic />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
