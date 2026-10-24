import { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { requestPersistence } from './database/db';
import { useRoute } from './hooks/useRoute';
import History from './pages/History';
import Home from './pages/Home';
import InspectionPage from './pages/InspectionPage';
import NewInspection from './pages/NewInspection';
import Report from './pages/Report';
import Review from './pages/Review';
import Settings from './pages/Settings';
import Vehicles from './pages/Vehicles';
import ViewInspection from './pages/ViewInspection';

function Router() {
  const [page, id, extra] = useRoute();
  switch (page) {
    case 'veiculos':
      return <Vehicles openForm={window.location.hash.includes('?novo')} />;
    case 'nova':
      return <NewInspection />;
    case 'vistoria':
      return id ? <InspectionPage id={id} itemNo={Math.min(29, Math.max(1, Number(extra) || 1))} /> : <Home />;
    case 'revisao':
      return id ? <Review id={id} /> : <Home />;
    case 'relatorio':
      return id ? <Report id={id} /> : <Home />;
    case 'consulta':
      return id ? <ViewInspection id={id} /> : <Home />;
    case 'historico':
      return <History />;
    case 'ajustes':
      return <Settings />;
    default:
      return <Home />;
  }
}

export default function App() {
  useEffect(() => {
    void requestPersistence(); // pede ao navegador para não apagar os dados do app
  }, []);
  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
}
