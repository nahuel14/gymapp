import { TemplateEditorClient } from "./TemplateEditorClient";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorClient templateId={Number(id)} />;
}
