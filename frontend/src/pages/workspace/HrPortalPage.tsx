import { useParams } from 'react-router-dom';
import HrPersonnel from '../../components/hr/HrPersonnel';
import HrAttendance from '../../components/hr/HrAttendance';
import HrPayroll from '../../components/hr/HrPayroll';
import { Navigate } from 'react-router-dom';

export default function HrPortalPage() {
  const { section } = useParams();

  switch (section) {
    case 'personnel':
      return <HrPersonnel />;
    case 'attendance':
      return <HrAttendance />;
    case 'payroll':
      return <HrPayroll />;
    default:
      return <Navigate to="/cortex/hr/personnel" replace />;
  }
}
