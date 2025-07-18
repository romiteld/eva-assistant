#!/usr/bin/env python3

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import os
import sys

class EVATestRunner:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.auth_token = None
        self.results = []
        self.start_time = datetime.now()
        
    def authenticate(self) -> bool:
        """Attempt to authenticate with the application"""
        print("🔐 Attempting authentication...")
        
        # Try to get CSRF token first
        try:
            csrf_response = self.session.get(f"{self.base_url}/api/csrf")
            if csrf_response.status_code == 200:
                csrf_data = csrf_response.json()
                self.session.headers.update({
                    'X-CSRF-Token': csrf_data.get('csrfToken', '')
                })
        except:
            pass
        
        # Check auth status
        try:
            auth_status = self.session.get(f"{self.base_url}/api/auth-status")
            if auth_status.status_code == 200:
                data = auth_status.json()
                if data.get('authenticated'):
                    print("✅ Already authenticated")
                    return True
        except:
            pass
            
        print("⚠️  Not authenticated - tests will run without auth")
        return False
    
    def test_endpoint(self, method: str, endpoint: str, description: str, 
                     data: Optional[Dict] = None, expected_status: List[int] = None) -> Dict:
        """Test a single endpoint"""
        if expected_status is None:
            expected_status = [200, 201, 204]
            
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()
        
        result = {
            "method": method,
            "endpoint": endpoint,
            "description": description,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            if method == "GET":
                response = self.session.get(url)
            elif method == "POST":
                response = self.session.post(url, json=data)
            elif method == "PUT":
                response = self.session.put(url, json=data)
            elif method == "DELETE":
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            response_time = (time.time() - start_time) * 1000  # ms
            
            result.update({
                "status": "success" if response.status_code in expected_status else "failure",
                "status_code": response.status_code,
                "response_time": round(response_time, 2),
                "response_size": len(response.content)
            })
            
            # Try to parse JSON response
            try:
                result["response_data"] = response.json()
            except:
                result["response_text"] = response.text[:500]  # First 500 chars
                
        except Exception as e:
            result.update({
                "status": "error",
                "error": str(e),
                "response_time": (time.time() - start_time) * 1000
            })
            
        self.results.append(result)
        
        # Print result
        status_icon = "✅" if result["status"] == "success" else "❌"
        print(f"{status_icon} [{method}] {endpoint} - {result.get('status_code', 'ERROR')} ({result['response_time']:.0f}ms)")
        
        return result
    
    def test_all_endpoints(self):
        """Run all endpoint tests"""
        print("\n🚀 Starting EVA Assistant Comprehensive Test Suite\n")
        
        # Authenticate
        self.authenticate()
        
        # Test categories
        self.test_health_endpoints()
        self.test_auth_endpoints()
        self.test_dashboard_pages()
        self.test_api_endpoints()
        self.test_integration_endpoints()
        self.test_ai_features()
        self.test_communication_features()
        
    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n📊 Testing Health Endpoints...")
        self.test_endpoint("GET", "/api/health", "General Health Check")
        self.test_endpoint("GET", "/api/health/database", "Database Health Check")
        self.test_endpoint("GET", "/api/test/integration-health", "Integration Health")
        
    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        self.test_endpoint("GET", "/api/auth-status", "Auth Status")
        self.test_endpoint("GET", "/api/verify-session", "Verify Session")
        self.test_endpoint("GET", "/api/test-session", "Test Session")
        self.test_endpoint("GET", "/api/csrf", "CSRF Token")
        self.test_endpoint("GET", "/api/auth/microsoft/check-config", "Microsoft Auth Config")
        
    def test_dashboard_pages(self):
        """Test dashboard pages"""
        print("\n📱 Testing Dashboard Pages...")
        pages = [
            ("/dashboard", "Main Dashboard"),
            ("/dashboard/analytics", "Analytics"),
            ("/dashboard/calls", "Calls"),
            ("/dashboard/competitor-analysis", "Competitor Analysis"),
            ("/dashboard/content-studio", "Content Studio"),
            ("/dashboard/deals", "Deals"),
            ("/dashboard/documents", "Documents"),
            ("/dashboard/email-templates", "Email Templates"),
            ("/dashboard/eva-voice", "EVA Voice"),
            ("/dashboard/files", "Files"),
            ("/dashboard/firecrawl", "Firecrawl"),
            ("/dashboard/lead-generation", "Lead Generation"),
            ("/dashboard/linkedin", "LinkedIn"),
            ("/dashboard/messages", "Messages"),
            ("/dashboard/monitoring", "Monitoring"),
            ("/dashboard/orchestrator", "Orchestrator"),
            ("/dashboard/outreach", "Outreach"),
            ("/dashboard/performance", "Performance"),
            ("/dashboard/post-predictor", "Post Predictor"),
            ("/dashboard/recruiter-intel", "Recruiter Intel"),
            ("/dashboard/settings", "Settings"),
            ("/dashboard/sharepoint", "SharePoint"),
            ("/dashboard/tasks", "Tasks"),
            ("/dashboard/teams", "Teams"),
            ("/dashboard/twilio", "Twilio"),
            ("/dashboard/workflows", "Workflows"),
            ("/dashboard/zoho", "Zoho"),
            ("/dashboard/zoom", "Zoom")
        ]
        
        for endpoint, description in pages:
            self.test_endpoint("GET", endpoint, f"Dashboard - {description}")
            
    def test_api_endpoints(self):
        """Test core API endpoints"""
        print("\n🔌 Testing Core API Endpoints...")
        
        # Tasks
        self.test_endpoint("GET", "/api/tasks", "Get Tasks")
        self.test_endpoint("POST", "/api/tasks", "Create Task", {
            "title": "Test Task",
            "description": "Automated test",
            "status": "todo"
        })
        
        # Recruiters
        self.test_endpoint("GET", "/api/recruiters", "Get Recruiters")
        self.test_endpoint("GET", "/api/recruiters/metrics", "Recruiter Metrics")
        self.test_endpoint("GET", "/api/recruiters/insights", "Recruiter Insights")
        
        # Deals
        self.test_endpoint("GET", "/api/deals/metrics", "Deal Metrics")
        
        # Email Templates
        self.test_endpoint("GET", "/api/email-templates", "Email Templates")
        
    def test_integration_endpoints(self):
        """Test integration endpoints"""
        print("\n🔗 Testing Integration Endpoints...")
        
        # Zoho
        self.test_endpoint("GET", "/api/zoho/queue", "Zoho Queue")
        
        # LinkedIn
        self.test_endpoint("GET", "/api/linkedin/token", "LinkedIn Token")
        self.test_endpoint("GET", "/api/linkedin/stats", "LinkedIn Stats")
        
        # Microsoft
        self.test_endpoint("GET", "/api/microsoft/calendar", "Microsoft Calendar")
        self.test_endpoint("GET", "/api/microsoft/teams", "Microsoft Teams")
        self.test_endpoint("GET", "/api/microsoft/contacts", "Microsoft Contacts")
        
        # Twilio
        self.test_endpoint("GET", "/api/twilio/status", "Twilio Status")
        self.test_endpoint("GET", "/api/twilio/config", "Twilio Config")
        
        # Zoom
        self.test_endpoint("GET", "/api/zoom/auth/status", "Zoom Auth Status")
        self.test_endpoint("GET", "/api/zoom/user", "Zoom User")
        
    def test_ai_features(self):
        """Test AI feature endpoints"""
        print("\n🤖 Testing AI Features...")
        
        self.test_endpoint("POST", "/api/gemini", "Gemini AI", {"prompt": "Test"})
        self.test_endpoint("GET", "/api/agents", "AI Agents")
        self.test_endpoint("GET", "/api/agents/stats", "Agent Stats")
        self.test_endpoint("GET", "/api/agents/workflows", "Agent Workflows")
        self.test_endpoint("POST", "/api/chat", "Chat API", {"message": "Test"})
        
        # Firecrawl
        self.test_endpoint("POST", "/api/firecrawl/scrape", "Firecrawl Scrape", 
                          {"url": "https://example.com"})
        
    def test_communication_features(self):
        """Test communication endpoints"""
        print("\n📞 Testing Communication Features...")
        
        self.test_endpoint("GET", "/api/socket", "WebSocket")
        self.test_endpoint("GET", "/api/monitoring/metrics", "Monitoring Metrics")
        
    def generate_report(self):
        """Generate comprehensive test report"""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        # Calculate statistics
        total_tests = len(self.results)
        successful = len([r for r in self.results if r["status"] == "success"])
        failed = len([r for r in self.results if r["status"] == "failure"])
        errors = len([r for r in self.results if r["status"] == "error"])
        
        # Group by category
        categories = {}
        for result in self.results:
            endpoint = result["endpoint"]
            if "/api/auth" in endpoint:
                category = "Authentication"
            elif "/dashboard" in endpoint:
                category = "Dashboard"
            elif "/api/zoho" in endpoint or "/api/linkedin" in endpoint or \
                 "/api/microsoft" in endpoint or "/api/twilio" in endpoint or \
                 "/api/zoom" in endpoint:
                category = "Integrations"
            elif "/api/gemini" in endpoint or "/api/agents" in endpoint or \
                 "/api/chat" in endpoint or "/firecrawl" in endpoint:
                category = "AI Features"
            else:
                category = "Core API"
                
            if category not in categories:
                categories[category] = {"total": 0, "success": 0, "failed": 0}
            
            categories[category]["total"] += 1
            if result["status"] == "success":
                categories[category]["success"] += 1
            else:
                categories[category]["failed"] += 1
        
        # Generate report
        report = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "duration": f"{duration:.2f}s",
                "base_url": self.base_url
            },
            "summary": {
                "total_tests": total_tests,
                "successful": successful,
                "failed": failed,
                "errors": errors,
                "success_rate": f"{(successful/total_tests*100):.1f}%"
            },
            "categories": categories,
            "results": self.results,
            "critical_issues": self._find_critical_issues(),
            "recommendations": self._generate_recommendations()
        }
        
        # Save JSON report
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        json_file = f"test-report-{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(report, f, indent=2)
            
        # Generate markdown report
        self._generate_markdown_report(report, timestamp)
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Successful: {successful}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Errors: {errors}")
        print(f"📈 Success Rate: {(successful/total_tests*100):.1f}%")
        print(f"⏱️  Duration: {duration:.2f}s")
        print(f"\n📄 Reports saved:")
        print(f"   - JSON: {json_file}")
        print(f"   - Markdown: test-report-{timestamp}.md")
        
    def _find_critical_issues(self) -> List[Dict]:
        """Find critical issues from test results"""
        critical = []
        
        for result in self.results:
            if result["status"] != "success":
                if result.get("status_code") == 500:
                    critical.append({
                        "severity": "CRITICAL",
                        "endpoint": result["endpoint"],
                        "error": "Internal Server Error"
                    })
                elif result["status"] == "error":
                    critical.append({
                        "severity": "HIGH",
                        "endpoint": result["endpoint"],
                        "error": result.get("error", "Unknown error")
                    })
                elif "/auth" in result["endpoint"] and result.get("status_code") == 401:
                    critical.append({
                        "severity": "HIGH",
                        "endpoint": result["endpoint"],
                        "error": "Authentication failure"
                    })
                    
        return critical
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        # Check authentication
        auth_failures = [r for r in self.results if "/auth" in r["endpoint"] and r["status"] != "success"]
        if auth_failures:
            recommendations.append("🔐 Review authentication configuration - multiple auth endpoints failing")
            
        # Check integrations
        integration_failures = [r for r in self.results if any(x in r["endpoint"] for x in ["/zoho", "/linkedin", "/microsoft", "/twilio", "/zoom"]) and r["status"] != "success"]
        if integration_failures:
            recommendations.append("🔗 Check external integration configurations and API keys")
            
        # Check slow endpoints
        slow_endpoints = [r for r in self.results if r.get("response_time", 0) > 3000]
        if slow_endpoints:
            recommendations.append("🐌 Optimize slow endpoints (>3s response time)")
            
        # Check error rate
        error_rate = len([r for r in self.results if r["status"] != "success"]) / len(self.results)
        if error_rate > 0.2:
            recommendations.append("⚠️  High error rate detected - review application logs")
            
        return recommendations
    
    def _generate_markdown_report(self, report: Dict, timestamp: str):
        """Generate markdown report"""
        md_content = f"""# EVA Assistant Test Report

**Generated:** {report['metadata']['timestamp']}  
**Duration:** {report['metadata']['duration']}  
**Base URL:** {report['metadata']['base_url']}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | {report['summary']['total_tests']} |
| ✅ Successful | {report['summary']['successful']} |
| ❌ Failed | {report['summary']['failed']} |
| ⚠️ Errors | {report['summary']['errors']} |
| 📈 Success Rate | {report['summary']['success_rate']} |

## 📂 Category Breakdown

| Category | Total | Success | Failed | Success Rate |
|----------|-------|---------|--------|--------------|
"""
        
        for category, stats in report['categories'].items():
            success_rate = (stats['success'] / stats['total'] * 100) if stats['total'] > 0 else 0
            md_content += f"| {category} | {stats['total']} | {stats['success']} | {stats['failed']} | {success_rate:.1f}% |\n"
            
        # Critical issues
        if report['critical_issues']:
            md_content += "\n## 🚨 Critical Issues\n\n"
            for issue in report['critical_issues']:
                md_content += f"- **[{issue['severity']}]** {issue['endpoint']}: {issue['error']}\n"
        else:
            md_content += "\n## ✅ No Critical Issues Found\n"
            
        # Recommendations
        if report['recommendations']:
            md_content += "\n## 💡 Recommendations\n\n"
            for rec in report['recommendations']:
                md_content += f"- {rec}\n"
                
        # Failed endpoints
        failed_results = [r for r in report['results'] if r['status'] != 'success']
        if failed_results:
            md_content += "\n## ❌ Failed Endpoints\n\n"
            md_content += "| Method | Endpoint | Status Code | Error |\n"
            md_content += "|--------|----------|-------------|-------|\n"
            for result in failed_results[:20]:  # Show first 20
                error = result.get('error', 'N/A')[:50]
                md_content += f"| {result['method']} | {result['endpoint']} | {result.get('status_code', 'N/A')} | {error} |\n"
                
        # Save markdown
        with open(f"test-report-{timestamp}.md", 'w') as f:
            f.write(md_content)

if __name__ == "__main__":
    # Get base URL from environment or command line
    base_url = os.environ.get("BASE_URL", "http://localhost:3000")
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
        
    print(f"🎯 Testing EVA Assistant at: {base_url}")
    
    # Run tests
    runner = EVATestRunner(base_url)
    runner.test_all_endpoints()
    runner.generate_report()