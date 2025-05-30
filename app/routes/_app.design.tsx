import { redirect } from "react-router";

import { Button } from "~/components/ui/button";

export const loader = () => (import.meta.env.PROD ? redirect("/") : null);

export default function Design() {
  return (
    <div className="flex flex-col items-start gap-y-4">
      <h1 className="font-display text-4xl font-bold">CAUSEWAY</h1>
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <div className="bg-background text-foreground border-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">background</span>
      </div>
      <div className="bg-foreground text-background border-background grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">foreground</span>
      </div>
      <div className="bg-card text-card-foreground border-card-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">card</span>
      </div>
      <div className="bg-primary text-primary-foreground border-primary-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">primary</span>
      </div>
      <div className="bg-secondary text-secondary-foreground border-secondary-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">secondary</span>
      </div>
      <div className="bg-accent text-accent-foreground border-accent-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">accent</span>
      </div>
      <div className="bg-baby-blue text-foreground border-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">accent 2</span>
      </div>
      <div className="bg-gold text-foreground border-foreground grid size-20 place-items-center rounded-lg border">
        <span className="text-xs">accent 2</span>
      </div>
    </div>
  );
}
