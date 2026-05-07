import { AppShell } from '@/components/app/app-shell';
import { FacilityFavoritesClient } from '@/components/facility/facility-favorites-client';

export default function Page() {
  return (
    <AppShell role="facility" title="Favorites" subtitle="Preferred workers.">
      <FacilityFavoritesClient />
    </AppShell>
  );
}
