import React, { useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicApproval } from "@/lib/use-approval";

export default function ApprovePublic({ token }: { token: string }) {
  const { data, isLoading, error, updateImage } = usePublicApproval(token);
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const handleAction = async (imageId: number, status: "approved" | "rejected") => {
    setSubmittingId(imageId);
    try {
      await updateImage.mutateAsync({ imageId, status, clientNote: noteInputs[imageId] || "" });
    } catch {
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          {msg === "expired" ? (
            <>
              <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
              <p className="text-zinc-400">This approval link has expired. Please contact us for a new link.</p>
            </>
          ) : msg === "not_found" ? (
            <>
              <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
              <p className="text-zinc-400">This approval link doesn't exist. Please check the link and try again.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-zinc-400">Please try again later or contact us.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allReviewed = data.images.every((img) => img.status !== "pending");
  const approvedCount = data.images.filter((img) => img.status === "approved").length;
  const rejectedCount = data.images.filter((img) => img.status === "rejected").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-pink-500" />
            <span className="font-bold text-lg">
              <span className="text-white">CyberSuite</span>{" "}
              <span className="text-pink-400">Image Approval</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="font-medium text-white">{data.name}</span>
            {data.clientName && <span>for {data.clientName}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {allReviewed && (
          <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 mb-6 text-center">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="font-medium text-green-300">All images reviewed - thank you!</p>
            <p className="text-sm text-green-400/70 mt-1">{approvedCount} approved, {rejectedCount} rejected</p>
          </div>
        )}

        <p className="text-zinc-400 text-sm mb-6">
          Please review each image below. Tap approve or reject, and optionally leave a note.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {data.images.map((img) => {
            const isPending = img.status === "pending";
            const isApproved = img.status === "approved";
            const isRejected = img.status === "rejected";

            return (
              <div key={img.id} className={`bg-zinc-900 border rounded-xl overflow-hidden transition-all ${isApproved ? "border-green-600" : isRejected ? "border-red-600" : "border-zinc-800"}`}>
                <div className="aspect-[4/5] relative bg-zinc-800">
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                  {!isPending && (
                    <div className={`absolute inset-0 flex items-center justify-center ${isApproved ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      <div className={`p-3 rounded-full ${isApproved ? "bg-green-600" : "bg-red-600"}`}>
                        {isApproved ? <CheckCircle2 className="w-8 h-8 text-white" /> : <XCircle className="w-8 h-8 text-white" />}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {isPending ? (
                    <>
                      <textarea
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-500 resize-none mb-3 focus:outline-none focus:border-pink-500"
                        rows={2}
                        placeholder="Leave a note (optional)"
                        value={noteInputs[img.id] || ""}
                        onChange={(e) => setNoteInputs((prev) => ({ ...prev, [img.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          disabled={submittingId === img.id}
                          onClick={() => handleAction(img.id, "approved")}
                        >
                          {submittingId === img.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          disabled={submittingId === img.id}
                          onClick={() => handleAction(img.id, "rejected")}
                        >
                          {submittingId === img.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                          Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm">
                      <div className={`flex items-center gap-2 font-medium ${isApproved ? "text-green-400" : "text-red-400"}`}>
                        {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {isApproved ? "Approved" : "Rejected"}
                      </div>
                      {img.clientNote && <p className="text-zinc-400 mt-1 italic">"{img.clientNote}"</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800 py-3">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Powered by CyberSuite Image Approval System</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />{approvedCount}</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{rejectedCount}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" />{data.images.filter((i) => i.status === "pending").length}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
