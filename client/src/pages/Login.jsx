// frontend/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import api from "../components/axiosconfig/axiosConfig";
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  UserIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimit, setRateLimit] = useState({
    locked: false,
    attempts: 0,
    remaining: 5,
    minutesLeft: 0,
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    const checkLoginStatus = async () => {
      if (!credentials.username || credentials.username.length < 3) return;

      setCheckingStatus(true);
      try {
        const response = await api.get(
          `/login-status?username=${credentials.username}`,
        );
        setRateLimit(response.data);
      } catch (error) {
        console.error("Error checking login status:", error);
      } finally {
        setCheckingStatus(false);
      }
    };

    const debounce = setTimeout(checkLoginStatus, 500);
    return () => clearTimeout(debounce);
  }, [credentials.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rateLimit.locked) {
      setError(
        `Account is locked. Please try again in ${rateLimit.minutesLeft} minutes.`,
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/login", credentials);

      login(response.data.user, response.data.token);

      const userRole = response.data.user.role_name.toLowerCase();
      let redirectPath = "/dashboard";

      switch (userRole) {
        case "admin":
          redirectPath = "/dashboard";
          break;
        default:
          redirectPath = "/profile";
      }

      navigate(redirectPath, { replace: true });
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Login failed.";
      setError(errorMsg);

      if (error.response?.status === 429) {
        const minutesMatch = errorMsg.match(/(\d+)/);
        const minutesLeft = minutesMatch ? parseInt(minutesMatch[0]) : 15;
        setRateLimit((prev) => ({
          ...prev,
          locked: true,
          minutesLeft,
        }));
      } else {
        setRateLimit((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          remaining: Math.max(0, prev.remaining - 1),
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Simple Header with Logo */}
      <div className="bg-white">
        <div className="max-w-md mx-auto px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-3">
            <span className="text-white text-xl font-bold">T</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Trackers</h1>
          <p className="text-gray-500 text-sm mt-1">School Management System</p>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome Back
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Sign in to your account
              </p>
            </div>

            {/* Rate Limit Warning */}
            {rateLimit.locked && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center text-red-700">
                  <LockClosedIcon className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">
                    Account Temporarily Locked
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Too many failed attempts. Try again in {rateLimit.minutesLeft}{" "}
                  minutes.
                </p>
              </div>
            )}

            {/* Attempts Remaining */}
            {!rateLimit.locked && rateLimit.attempts > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  ⚠️ {rateLimit.remaining} login{" "}
                  {rateLimit.remaining === 1 ? "attempt" : "attempts"} remaining
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && !rateLimit.locked && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) =>
                      setCredentials({
                        ...credentials,
                        username: e.target.value,
                      })
                    }
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                      rateLimit.locked
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                    required
                    disabled={loading || rateLimit.locked}
                    placeholder="Enter your username"
                  />
                  {checkingStatus && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials({
                        ...credentials,
                        password: e.target.value,
                      })
                    }
                    className={`block w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                      rateLimit.locked
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                    required
                    disabled={loading || rateLimit.locked}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    disabled={rateLimit.locked}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || rateLimit.locked}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : rateLimit.locked ? (
                  "Account Locked"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* <div className="mt-6 text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Forgot your password?
              </Link>
            </div> */}

            {/* Simple footer text */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">
                Secure login • 256-bit SSL encryption
              </p>
            </div>
          </div>

          {/* Simple description */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              © 2026 Trackers. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
