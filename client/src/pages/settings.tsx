import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
      </div>

      <Card className="p-5 backdrop-blur-xl bg-card/80 border-card-border space-y-4">
        <h3 className="font-semibold">Profile</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" defaultValue="Premium Agent" data-testid="input-fullname" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="agent@taste.com" data-testid="input-email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" defaultValue="+1 (555) 234-5678" data-testid="input-phone" />
          </div>
        </div>
        <Button onClick={() => toast({ title: "Profile saved" })} data-testid="button-save-profile">Save Changes</Button>
      </Card>

      <Card className="p-5 backdrop-blur-xl bg-card/80 border-card-border space-y-4">
        <h3 className="font-semibold">Notifications</h3>
        <Separator />
        <div className="space-y-4">
          {[
            { id: "leads", label: "New Lead Alerts", desc: "Get notified when a new lead is captured" },
            { id: "views", label: "Listing Views", desc: "Daily summary of property views" },
            { id: "email-digest", label: "Email Digest", desc: "Weekly performance summary" },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={item.id}>{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch id={item.id} defaultChecked data-testid={`switch-${item.id}`} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
