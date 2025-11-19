// components/Home.tsx
"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { AxiosError } from "../../node_modules/axios/index";

interface FormData {
  githubToken: string;
  googleKey: string;
  owner: string;
  repo: string;
}

interface ReviewResult {
  message?: string;
  error?: string;
  owner?: string;
  commitsReviewed?: string[];
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    githubToken: "",
    googleKey: "",
    owner: "",
    repo: "",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setResult(null);
    // const url = "http://localhost:4000/review"; // for dev
    const url = "https://backend-api-seven-pi.vercel.app/review"; // for prod

    try {
      const response = await axios.post<ReviewResult>(url, formData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      setResult(response.data);
    } catch (error) {
      const err = error as AxiosError<{ error: string }>;
      setResult({
        error: err.response?.data?.error || "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <h1 className="text-3xl font-bold text-center mb-6">
        PR Review Assistant
      </h1>

      {/* Form */}
      <div className="bg-white shadow-md rounded p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="githubToken"
            placeholder="GitHub Access Token"
            value={formData.githubToken}
            onChange={handleChange}
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            name="googleKey"
            placeholder="Google Key"
            value={formData.googleKey}
            onChange={handleChange}
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            name="owner"
            placeholder="Owner Name"
            value={formData.owner}
            onChange={handleChange}
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            name="repo"
            placeholder="Repository Name"
            value={formData.repo}
            onChange={handleChange}
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold p-3 rounded transition"
          >
            {loading ? "Processing..." : "Get Review Feedback"}
          </button>
        </form>

        {/* Loader */}
        {loading && (
          <div className="mt-4 flex justify-center items-center space-x-2">
            <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-600 font-medium">
              Review in progress...
            </span>
          </div>
        )}
      </div>

      {/* Result / Conversation */}
      {result && (
        <div className="bg-gray-50 shadow-md rounded p-6">
          <h2 className="text-2xl font-semibold mb-4">Review Result</h2>

          {result.message && (
            <div className="p-4 mb-4 border-l-4 border-green-500 bg-green-100 text-green-800 rounded">
              ✅ {result.message}
              {result.owner !== undefined && <p>owner: {result.owner}</p>}
              {result.commitsReviewed && result.commitsReviewed.length > 0 && (
                <p>Commits Reviewed: {result.commitsReviewed.join(", ")}</p>
              )}
            </div>
          )}

          {result.error && (
            <div className="p-4 mb-4 border-l-4 border-red-500 bg-red-100 text-red-800 rounded">
              ❌ {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
