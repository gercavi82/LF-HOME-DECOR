import { ContentContainer, PageHeader } from "./content";
import { EmptyState } from "@/src/components/ui";

export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <ContentContainer>
      <PageHeader eyebrow="Mi Hogar y Confort" title={title} description={description} />
      <EmptyState title={`${title} en preparación`} description="El acceso y el layout ya están protegidos. Las funciones del módulo se incorporarán en su fase correspondiente." />
    </ContentContainer>
  );
}
