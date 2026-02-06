#!/usr/bin/env python3
"""
Generate PDF Cost Analysis Report

Creates a comprehensive PDF report with:
- US Cost Structure for CAST commands
- Launch pricing analysis ($49.99 → $29.99)
- Usage coverage analysis ($3 gateway budget)
- Provider comparisons (Twilio vs Telnyx)
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from datetime import datetime
import os

# Output path
OUTPUT_DIR = os.path.expanduser("~/Downloads")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "Thunderbird_Cost_Analysis_Report.pdf")

# Data from our analysis
TWILIO_COST = 0.0083
TELNYX_COST = 0.0040

CAST7_SEGMENTS = 3
CAST12_SEGMENTS = 4
CAST24_SEGMENTS = 8


def create_pdf():
    """Generate the PDF report."""

    # Create PDF
    doc = SimpleDocTemplate(OUTPUT_FILE, pagesize=letter,
                           rightMargin=0.75*inch, leftMargin=0.75*inch,
                           topMargin=0.75*inch, bottomMargin=0.75*inch)

    # Container for the 'Flowable' objects
    elements = []

    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#ea580c'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#ea580c'),
        spaceAfter=12,
        spaceBefore=20,
    )

    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#4b5563'),
        spaceAfter=8,
        spaceBefore=12,
    )

    # Title
    elements.append(Paragraph("Thunderbird Weather", title_style))
    elements.append(Paragraph("US Cost Structure Analysis", heading_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Executive Summary
    elements.append(Paragraph("Executive Summary", heading_style))
    summary_text = """
    This report analyzes the cost structure and profitability of Thunderbird's SMS-based
    weather forecast service for the US market. Key findings show exceptional margins
    (91.7% with Twilio, 96% with Telnyx) and strong competitive positioning at 13-20×
    cheaper than satellite device alternatives like Garmin inReach and Zoleo.
    """
    elements.append(Paragraph(summary_text, styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Section 1: Command Costs
    elements.append(Paragraph("1. SMS Command Sizes & Costs", heading_style))

    command_data = [
        ['Command', 'Characters', 'SMS Segments', 'Twilio Cost', 'Telnyx Cost', 'Customer Pays'],
        ['CAST7', '361', '3', '$0.0249', '$0.0120', '$0.30'],
        ['CAST12', '572', '4', '$0.0332', '$0.0160', '$0.40'],
        ['CAST24', '1,073', '8', '$0.0664', '$0.0320', '$0.80'],
    ]

    command_table = Table(command_data, colWidths=[1*inch, 1*inch, 1.2*inch, 1*inch, 1*inch, 1.2*inch])
    command_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ea580c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))
    elements.append(command_table)
    elements.append(Spacer(1, 0.2*inch))

    # Margins
    margin_text = """
    <b>Profit Margins:</b> 91.7% with Twilio, 96.0% with Telnyx. High margins are due to
    the difference between SMS gateway costs ($0.0083-0.0040/segment) and customer
    pricing ($0.10/segment).
    """
    elements.append(Paragraph(margin_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Section 2: Launch Pricing Model
    elements.append(Paragraph("2. Launch Pricing Model", heading_style))
    elements.append(Paragraph("$49.99 → $29.99 with $29.99 SMS Credits", subheading_style))

    launch_data = [
        ['Item', 'Amount', 'Notes'],
        ['List Price', '$49.99', 'Regular retail price'],
        ['Launch Price', '$29.99', '40% launch discount'],
        ['SMS Credits Included', '$29.99', '299 segments'],
        ['', '', ''],
        ['Revenue', '$29.99', 'Customer payment'],
        ['Affiliate (30%)', '-$9.00', 'Influencer commission'],
        ['Stripe Fees', '-$1.17', '2.9% + $0.30'],
        ['SMS Cost (Twilio)', '-$2.48', 'Actual provider cost'],
        ['Net Profit', '$17.34', '57.8% margin'],
    ]

    launch_table = Table(launch_data, colWidths=[2*inch, 1.5*inch, 2.5*inch])
    launch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ea580c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 3), colors.lightblue),
        ('BACKGROUND', (0, 5), (-1, 8), colors.lightyellow),
        ('BACKGROUND', (0, 9), (-1, 9), colors.lightgreen),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 9), (-1, 9), 'Helvetica-Bold'),
        ('LINEABOVE', (0, 4), (-1, 4), 2, colors.black),
        ('LINEABOVE', (0, 9), (-1, 9), 2, colors.black),
    ]))
    elements.append(launch_table)
    elements.append(Spacer(1, 0.2*inch))

    profitability_text = """
    <b>Why This Works:</b> The $29.99 in SMS credits only costs $2.48 (Twilio) or $1.20
    (Telnyx) to provide. Even after 30% affiliate commission and payment processing fees,
    the business nets $17.34 profit per sale. With Telnyx, profit increases to $18.63 (62.1% margin).
    """
    elements.append(Paragraph(profitability_text, styles['Normal']))

    # Page break
    elements.append(PageBreak())

    # Section 3: Usage Coverage Analysis
    elements.append(Paragraph("3. Usage Coverage ($3 Gateway Budget)", heading_style))

    coverage_text = """
    Analysis of how many CAST commands fit within a $3 SMS gateway spend cap (actual cost
    to Thunderbird, not customer revenue). This represents typical usage for a week-long
    hiking trip with heavy forecast monitoring.
    """
    elements.append(Paragraph(coverage_text, styles['Normal']))
    elements.append(Spacer(1, 0.15*inch))

    # Segment budget table
    budget_data = [
        ['Provider', 'Cost/Segment', 'Total Segments', 'CAST7 Max', 'CAST12 Max', 'CAST24 Max'],
        ['Twilio', '$0.0083', '361', '120', '90', '45'],
        ['Telnyx', '$0.0040', '750', '250', '187', '93'],
        ['Difference', '52% cheaper', '+389 (+108%)', '+130', '+97', '+48'],
    ]

    budget_table = Table(budget_data, colWidths=[1.2*inch, 1.1*inch, 1.3*inch, 0.9*inch, 1*inch, 1*inch])
    budget_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ea580c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 2), colors.beige),
        ('BACKGROUND', (0, 3), (-1, 3), colors.lightgreen),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
    ]))
    elements.append(budget_table)
    elements.append(Spacer(1, 0.2*inch))

    # Real-world scenarios
    elements.append(Paragraph("Real-World Trip Scenarios", subheading_style))

    scenario_data = [
        ['Scenario', 'Commands', 'Segments', 'Twilio', 'Telnyx', 'Fits?'],
        ['7-day balanced', '1× CAST7\n7× CAST24\n14× CAST12', '115', '$0.95', '$0.46', '✓ Both'],
        ['7-day CAST24 only', '7× CAST24', '56', '$0.46', '$0.22', '✓ Both'],
        ['7-day CAST12 only', '14× CAST12', '56', '$0.46', '$0.22', '✓ Both'],
        ['14-day extended', '2× CAST7\n14× CAST24\n28× CAST12', '230', '$1.91', '$0.92', '✓ Both'],
    ]

    scenario_table = Table(scenario_data, colWidths=[1.3*inch, 1.8*inch, 1*inch, 0.9*inch, 0.9*inch, 0.9*inch])
    scenario_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ea580c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
    ]))
    elements.append(scenario_table)
    elements.append(Spacer(1, 0.2*inch))

    # Key insights
    insights_text = """
    <b>Key Insight:</b> $3 SMS gateway budget comfortably covers typical 7-day hiking trips
    with heavy forecast usage (115 segments, costing $0.46-$0.95). Even extended 14-day trips
    (230 segments) fit well within budget. Telnyx provides 108% more capacity for the same cost.
    """
    elements.append(Paragraph(insights_text, styles['Normal']))

    # Page break
    elements.append(PageBreak())

    # Section 4: Competitive Analysis
    elements.append(Paragraph("4. Competitive Positioning", heading_style))

    competitive_data = [
        ['Service', 'Device Cost', 'Monthly Fee', '7-Day Trip Cost'],
        ['Garmin inReach', '$549', '$30-65', '$599+'],
        ['Zoleo', '$349', '$25-50', '$399+'],
        ['Thunderbird', '$0', '$0', '$29.99'],
    ]

    competitive_table = Table(competitive_data, colWidths=[1.8*inch, 1.5*inch, 1.5*inch, 1.8*inch])
    competitive_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ea580c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 2), colors.lightyellow),
        ('BACKGROUND', (0, 3), (-1, 3), colors.lightgreen),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
    ]))
    elements.append(competitive_table)
    elements.append(Spacer(1, 0.2*inch))

    advantage_text = """
    <b>Competitive Advantage:</b> Thunderbird is 13-20× cheaper than satellite device
    alternatives for a first trip. No device purchase required - works with iPhone 14+
    satellite SMS or any existing satellite messaging device. No monthly subscription fees.
    """
    elements.append(Paragraph(advantage_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Section 5: Customer LTV
    elements.append(Paragraph("5. Customer Lifetime Value", heading_style))

    ltv_text = """
    <b>Scenario:</b> Active hiker doing 4 trips/year for 3 years (12 trips total)
    <br/><br/>
    <b>Initial Purchase:</b> $29.99 → Profit $17.34<br/>
    <b>Top-ups:</b> 12 trips × $11.50 = $138 → Profit $118.94<br/>
    <b>3-Year LTV:</b> $136.29 profit on $167.99 total revenue<br/>
    <br/>
    Top-up economics show 86.2% margin ($9.91 profit on $11.50 revenue) as there is no
    affiliate commission on subsequent purchases.
    """
    elements.append(Paragraph(ltv_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Section 6: Recommendations
    elements.append(Paragraph("6. Recommendations", heading_style))

    recommendations = """
    <b>1. Launch Pricing Strategy:</b> Use $49.99 → $29.99 with $29.99 credits model.
    The "platform is free, just buy credits" positioning is compelling and profitable.<br/><br/>

    <b>2. SMS Provider:</b> Consider switching from Twilio to Telnyx to improve margins from
    91.7% to 96% and reduce per-trip costs by 52%. This increases profit by $1.29 per
    initial sale and provides 2× capacity for the same gateway spend.<br/><br/>

    <b>3. Pricing Tiers:</b> Maintain $10/$25/$50 top-up structure with volume bonuses
    (+10% at $25, +20% at $50) to encourage larger purchases.<br/><br/>

    <b>4. Messaging:</b> Emphasize the 13-20× cost advantage vs Garmin/Zoleo and "no device,
    no subscription" positioning. The $29.99 price point is a psychological breakthrough
    compared to $400-600 alternatives.<br/><br/>

    <b>5. Budget Allocation:</b> $3 SMS gateway budget per user provides comfortable coverage
    for most trip scenarios with room for heavy usage or emergencies.
    """
    elements.append(Paragraph(recommendations, styles['Normal']))

    # Footer
    elements.append(Spacer(1, 0.5*inch))
    footer_text = f"""
    <i>Report generated {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</i><br/>
    <i>Thunderbird Weather - Alpine forecasts via satellite SMS</i><br/>
    <i>thunderbird.bot</i>
    """
    elements.append(Paragraph(footer_text, styles['Normal']))

    # Build PDF
    doc.build(elements)

    return OUTPUT_FILE


if __name__ == "__main__":
    print("Generating Thunderbird Cost Analysis PDF...")
    print(f"Output location: {OUTPUT_FILE}")

    output_path = create_pdf()

    print(f"\n✅ PDF generated successfully!")
    print(f"📄 Saved to: {output_path}")
    print(f"\nFile size: {os.path.getsize(output_path) / 1024:.1f} KB")
