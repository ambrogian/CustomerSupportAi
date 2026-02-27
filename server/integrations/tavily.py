"""
Tavily web search client — for real-time carrier delay news, weather disruptions, etc.
"""
import os
import requests


def search_web(query: str) -> dict:
    """
    Search the web for real-time context (carrier outages, weather, etc.).

    Returns:
        {
            "results": list[{"title": str, "url": str, "snippet": str}],
            "source": "tavily_real" | "tavily_mock" | "tavily_error"
        }
    """
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        print("[Tavily] Warning: TAVILY_API_KEY not set. Returning mock results.")
        return {
            "results": [],
            "source": "tavily_mock",
        }

    try:
        response = requests.post(
            "https://api.tavily.com/search",
            headers={"Content-Type": "application/json"},
            json={
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": 3,
                "include_images": False,
            }
        )
        response.raise_for_status()
        data = response.json()
        
        results = []
        for r in data.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", "")
            })
            
        return {
            "results": results,
            "source": "tavily_real"
        }
    except Exception as e:
        print(f"[Tavily] Error searching web: {e}")
        return {
            "results": [],
            "source": "tavily_error"
        }
