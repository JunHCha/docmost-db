import { Center, Loader, Text } from "@mantine/core";

// Loading splash shown in place of a list while a picker refetches on open
// (see useRefetchOnOpen). Matches the app's Center + Loader loading convention
// (relation-page-peek, template-peek-body). Reusable across any dropdown/modal
// that refreshes its list when shown.
export function ListFetchSplash({ label }: { label?: string }) {
  return (
    <Center py="md" style={{ flexDirection: "column", gap: 8 }}>
      <Loader size="sm" />
      {label ? (
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      ) : null}
    </Center>
  );
}

export default ListFetchSplash;
