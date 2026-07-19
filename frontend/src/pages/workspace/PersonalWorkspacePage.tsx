import { useParams } from "react-router-dom";
import PersonalFollowing from "../../components/personal/PersonalFollowing";
import PersonalReview from "../../components/personal/PersonalReview";
import PersonalPoints from "../../components/personal/PersonalPoints";
import PersonalProjects from "../../components/personal/PersonalProjects";
import PersonalTasks from "../../components/personal/PersonalTasks";
import PersonalAnnouncements from "../../components/personal/PersonalAnnouncements";
import PersonalStatus from "../../components/personal/PersonalStatus";
import PersonalPhoneRecords from "../../components/personal/PersonalPhoneRecords";
import PersonalMemos from "../../components/personal/PersonalMemos";
import PersonalDirectory from "../../components/personal/PersonalDirectory";
import PersonalSettings from "../../components/personal/PersonalSettings";

export default function PersonalWorkspacePage() {
  const { section = "following" } = useParams();

  switch (section) {
    case "following":
      return <PersonalFollowing />;
    case "review":
      return <PersonalReview />;
    case "points":
      return <PersonalPoints />;
    case "projects":
      return <PersonalProjects />;
    case "tasks":
      return <PersonalTasks />;
    case "announcements":
      return <PersonalAnnouncements />;
    case "status":
      return <PersonalStatus />;
    case "phone-records":
      return <PersonalPhoneRecords />;
    case "memos":
      return <PersonalMemos />;
    case "directory":
      return <PersonalDirectory />;
    case "settings":
      return <PersonalSettings />;
    default:
      return (
        <div className="flex h-screen items-center justify-center">
          <p className="text-gray-500">此頁面不存在</p>
        </div>
      );
  }
}
