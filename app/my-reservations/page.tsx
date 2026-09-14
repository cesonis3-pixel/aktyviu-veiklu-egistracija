import { MyReservations } from "@/components/my-reservations";
export default function MyReservationsPage() {
  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <h1>Mano rezervacijos</h1>
        <p>Tavo žiemos planai vienoje vietoje.</p>
      </div>
      <MyReservations />
    </main>
  );
}
