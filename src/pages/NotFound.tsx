import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">这个页面暂时不存在。</p>
      <Button asChild>
        <Link to="/">返回仪表盘</Link>
      </Button>
    </div>
  );
}
