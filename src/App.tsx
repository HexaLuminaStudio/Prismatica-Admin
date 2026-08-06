import * as React from "react";
import { AppRouter } from "@/router";
import { useSessionStore } from "@/store/session";

export function App(): React.ReactElement {
  const bootstrap = useSessionStore((s) => s.bootstrap);

  React.useEffect(() => {
    // 启动期:如果有 cookie → 试 fetchMe;无 → 直接落「未登录」态
    void bootstrap();
  }, [bootstrap]);

  return <AppRouter />;
}
