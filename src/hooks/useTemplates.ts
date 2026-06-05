import { useQuery } from "@tanstack/react-query";

export function useTemplate(templateId: number) {
  return useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}`);
      if (!response.ok) throw new Error("Error fetching template");
      return response.json();
    },
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
