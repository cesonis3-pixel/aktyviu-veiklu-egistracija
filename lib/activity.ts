export type Activity = {
  id: string;
  isReserved?: boolean;
  title: string;
  category: string;
  date: string;
  dateLabel: string;
  location: string;
  organizer: string;
  capacity: number;
  available: number;
  image: string;
  imageAlt: string;
  description: string;
};

