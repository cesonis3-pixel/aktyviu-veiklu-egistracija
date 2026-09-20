export type Activity = {
  id: string;
  creator_id?: string;
  isOwner?: boolean;
  isReserved?: boolean;
  canReactivate?: boolean;
  title: string;
  category: string;
  date: string;
  dateLabel: string;
  location: string;
  organizer: string;
  organizer_name?: string;
  capacity: number;
  available: number;
  status?: "active" | "cancelled";
  image: string;
  imageAlt: string;
  description: string;
};

