import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { withAuth } from "@/lib/api/with-auth";

export const runtime = "nodejs";

export const PATCH = apiHandler(
  async (
    _request: NextRequest,
    context: { params: { id: string } }
  ) => {
    const { supabase } = await withAuth(_request);

    // Check activity exists
    const { data: existing, error: findError } = await supabase
      .from("activities")
      .select("id")
      .eq("id", context.params.id)
      .maybeSingle();

    if (findError) {
      console.error("Error finding activity:", findError);
      return NextResponse.json(
        { error: "Error al buscar la actividad" },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      );
    }

    // Mark as read (completed = true)
    const { error: updateError } = await supabase
      .from("activities")
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", context.params.id);

    if (updateError) {
      console.error("Error marking activity as read:", updateError);
      return NextResponse.json(
        { error: "Error al marcar como leída" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  }
);
