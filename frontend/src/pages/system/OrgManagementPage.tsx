import { useParams } from 'react-router-dom';
import OrgDashboard from '../../components/org/OrgDashboard';
import OrgVendors from '../../components/org/OrgVendors';
import OrgCustomers from '../../components/org/OrgCustomers';
import OrgProducts from '../../components/org/OrgProducts';
import OrgResources from '../../components/org/OrgResources';
import OrgMeetings from '../../components/org/OrgMeetings';
import OrgFinance from '../../components/org/OrgFinance';
import OrgContracts from '../../components/org/OrgContracts';
import OrgAssets from '../../components/org/OrgAssets';
import OrgInventory from '../../components/org/OrgInventory';
import OrgWarehouse from '../../components/org/OrgWarehouse';

export default function OrgManagementPage() {
  const { section } = useParams();

  switch (section) {
    case 'vendors':
      return <OrgVendors />;
    case 'customers':
      return <OrgCustomers />;
    case 'products':
      return <OrgProducts />;
    case 'resources':
      return <OrgResources />;
    case 'meetings':
      return <OrgMeetings />;
    case 'finance':
      return <OrgFinance />;
    case 'contracts':
      return <OrgContracts />;
    case 'assets':
      return <OrgAssets />;
    case 'inventory':
      return <OrgInventory />;
    case 'warehouse':
      return <OrgWarehouse />;
    case 'dashboard':
    default:
      return <OrgDashboard />;
  }
}
