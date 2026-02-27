"""
Tavily web search client — for real-time carrier delay news, weather disruptions, etc.

MOCK: Returns empty results. Will be wired to real Tavily API at hackathon.
"""


def search_web(query: str) -> dict:
    """
    Search the web for real-time context (carrier outages, weather, etc.).

    Returns:
        {
            "results": list[{"title": str, "url": str, "snippet": str}],
            "source": "tavily_mock"
        }
    """
    return {
        "results": [],
        "source": "tavily_mock",
    }
