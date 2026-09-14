import { Icon } from "./icon";
export function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: "compass" | "ticket" | "plus";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="feature-card">
      <span className="feature-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
