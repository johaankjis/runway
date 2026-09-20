import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="py-16">
      <EmptyState
        title="Page not found"
        description="That route does not exist in Runway."
        action={<Button href="/">Back to Overview</Button>}
      />
    </div>
  );
}
