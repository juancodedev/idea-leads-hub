import { Phone, Users, Repeat, Mail, CheckSquare, FileText, Bell, MessageCircle } from "lucide-react";
import { ActivityType } from "../../domain/enums/ActivityType";

interface ActivityTypeIconProps {
  type: ActivityType;
  className?: string;
}

export function ActivityTypeIcon({ type, className }: ActivityTypeIconProps) {
  switch (type) {
    case ActivityType.CALL:
      return <Phone className={className} />;
    case ActivityType.MEETING:
      return <Users className={className} />;
    case ActivityType.FOLLOW_UP:
      return <Repeat className={className} />;
    case ActivityType.EMAIL:
      return <Mail className={className} />;
    case ActivityType.TASK:
      return <CheckSquare className={className} />;
    case ActivityType.NOTE:
      return <FileText className={className} />;
    case ActivityType.REMINDER:
      return <Bell className={className} />;
    case ActivityType.INSTAGRAM_MESSAGE:
      return <MessageCircle className={className} />;
    default:
      return <CheckSquare className={className} />;
  }
}
