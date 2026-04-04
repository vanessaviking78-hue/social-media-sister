import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db/schema";

export async function logActivity(params: {
  action: string;
  postType: string;
  clientName?: string;
  slideCount?: number;
  postCount?: number;
}) {
  try {
    await db.insert(activityLogTable).values({
      action: params.action,
      postType: params.postType,
      clientName: params.clientName || "",
      slideCount: params.slideCount || 0,
      postCount: params.postCount || 0,
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
