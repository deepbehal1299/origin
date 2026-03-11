# Origin — Coffee Discovery & Comparison App

## Overview

Origin is a Progressive Web App (PWA) that aggregates coffees from multiple specialty roasters and allows users to discover and compare coffees in a single interface.

The app simplifies the workflow of browsing multiple roaster websites and comparing coffees before making a purchase.

Origin does not handle checkout.  
When a user decides to buy a coffee, they are redirected to the roaster's website to complete the purchase.

---

# Problem Statement

Coffee enthusiasts often purchase beans from multiple specialty roasters. Discovering new coffees and comparing them requires browsing multiple websites.

This process usually involves:

- visiting several roaster websites
- opening multiple browser tabs
- manually comparing roast levels and tasting notes
- repeatedly checking sites for new coffees

This workflow is time consuming and inconvenient, especially on mobile.

There is currently no simple interface that allows users to view and compare coffees across multiple roasters in one place.

---

# Goals

The product should allow users to:

1. View coffees from multiple roasters in a single feed
2. Filter coffees based on roast level and roaster
3. Compare multiple coffees side-by-side
4. Quickly navigate to the roaster website to purchase coffee

---

# Non Goals (Version 1)

The following features are intentionally excluded from the first version:

- Checkout or marketplace functionality
- Payment processing
- Notifications or drop alerts
- Recommendation systems
- Advanced search or AI discovery
- User accounts or login
- Social or community features

---

# Target User

The primary user is a home coffee enthusiast who:

- regularly purchases specialty coffee beans
- uses multiple brewing methods
- orders from multiple specialty roasters
- enjoys discovering new coffees

Typical purchase behavior:

- roughly 500g of coffee per month
- 2–3 coffees per order
- regular browsing of roaster websites to find new beans

---

# Core User Workflow

A typical workflow in Origin looks like this:

1. User opens the app
2. User browses the coffee feed
3. User adds interesting coffees to a comparison list
4. User compares coffees side-by-side
5. User clicks **Buy** to open the roaster website and purchase the coffee

---

# Product Structure

The app contains three primary sections:

- Feed
- Compare
- Settings

Navigation between these sections should be simple and mobile-friendly.

---

# Feed

The Feed displays all available coffees aggregated from selected roasters.

Each coffee appears as an individual card.

## Coffee Card Information

Each card displays:

- Coffee name
- Roaster name
- Roast level
- Tasting notes
- Price
- Coffee image

## Card Actions

Users can perform three actions on each coffee:

**Save**

- Bookmark the coffee for later

**Compare**

- Add the coffee to the comparison list

**Buy**

- Opens the coffee product page on the roaster's website

---

# Feed Filters

Users can filter the feed using two filters.

## Roast Level

Available roast level options:

- Light
- Light-Medium
- Medium
- Medium-Dark
- Dark

## Roaster

Users can filter coffees by specific roasters.

---

# Compare Page

The Compare page allows users to compare multiple coffees side-by-side.

Users can compare up to **five coffees** at a time.

If a user attempts to add more than five coffees, the app should prevent additional coffees from being added.

## Comparison Fields

The comparison view shows the following fields for each coffee:

| Field | Description |
|------|-------------|
| Coffee Name | Name of the coffee |
| Brand | Roaster |
| Roast Level | Roast category |
| Tasting Notes | Flavor profile |
| Description | Origin / processing information |
| Price | Coffee price |
| Buy | Link to the roaster product page |

Users can remove coffees from the comparison view at any time.

---

# Settings

The Settings page allows users to configure the roasters that appear in the feed.

## Roaster Management

Users can enable or disable specific roasters.

Initial supported roasters:

- Subko
- Savorworks
- Bloom Coffee Roasters
- Rossette Coffee Lab
- Marcs Coffee
- Grey Soul Coffee

Disabling a roaster removes its coffees from the feed.

---

## Roast Preferences

Users can save preferred roast levels.

These preferences can influence feed filtering so that coffees matching the preferred roast levels appear first or are shown by default.

---

# Success Criteria

The application is successful if users can:

1. Discover coffees from multiple roasters in a single feed
2. Compare coffees without opening multiple browser tabs
3. Quickly navigate to the roaster website to purchase coffee

---

# Future Improvements

Potential improvements after the first version:

- limited release alerts
- restock notifications
- flavor profile filters
- personalized discovery
- additional roaster integrations
- subscription ordering
