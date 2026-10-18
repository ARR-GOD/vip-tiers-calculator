// ════════════════════════════════════════════════════════════════════
// Loyoly mission catalog — "Missions setup recommandé" (Notion)
// ════════════════════════════════════════════════════════════════════
//
// basePoints are on the 1 pt/€ grid: a mission is always worth the same
// "purchase equivalent" whatever earn rate the brand picks
// (points = basePoints × earn rate, see utils/pointsModel.js).
// completionRate: estimated % of customers who complete the mission in a year.
// caution: flagged ⚠️ in the Loyoly grid (check feasibility with the brand).

export const MISSION_CATEGORIES = [
  { id: 'fidelite', labelFr: 'Fidélité', labelEn: 'Loyalty' },
  { id: 'classic', labelFr: 'Classic', labelEn: 'Classic' },
  { id: 'avis', labelFr: 'Avis', labelEn: 'Reviews' },
  { id: 'contenu', labelFr: 'Contenu', labelEn: 'Content' },
  { id: 'engagement', labelFr: 'Engagement', labelEn: 'Engagement' },
];

export const ENGAGEMENT_LEVELS = {
  reference: { labelFr: 'Référence', labelEn: 'Reference' },
  low: { labelFr: 'Faible', labelEn: 'Low' },
  lowPlus: { labelFr: 'Faible +', labelEn: 'Low +' },
  medium: { labelFr: 'Moyen', labelEn: 'Medium' },
  high: { labelFr: 'Fort', labelEn: 'High' },
  veryHigh: { labelFr: 'Très fort', labelEn: 'Very high' },
  max: { labelFr: 'Maximal', labelEn: 'Maximum' },
};

const m = (id, icon, nameFr, nameEn, category, engagement, completionRate, basePoints, extra = {}) => ({
  id, icon, nameFr, nameEn, category, engagement, completionRate, basePoints, frequency: 1, ...extra,
});

export const MISSION_CATALOG = [
  // Fidélité — purchase points come from revenue × earn rate
  m('purchase', '🛒', 'Réalisez un achat', 'Make a purchase', 'fidelite', 'reference', 100, 1, { isPurchaseMission: true }),
  m('purchase_store', '🏬', 'Réalisez un achat en boutique', 'Make an in-store purchase', 'fidelite', 'reference', 100, 1, { isPurchaseMission: true }),
  // Classic
  m('account_creation', '👤', 'Créez un compte client', 'Create a customer account', 'classic', 'low', 50, 20),
  m('newsletter', '📧', 'Inscrivez-vous à la newsletter', 'Sign up to the newsletter', 'classic', 'low', 8, 20),
  m('birthday', '🎂', "Indiquez votre date d'anniversaire", 'Add your birthday', 'classic', 'low', 6, 20),
  m('phone', '📱', 'Complétez votre n° de téléphone', 'Add your phone number', 'classic', 'low', 4, 20),
  m('poll_single', '📊', 'Réalisez un sondage à choix unique', 'Answer a single-choice poll', 'classic', 'low', 5, 20),
  m('poll_images', '🖼️', 'Réalisez un sondage avec des images', 'Answer an image poll', 'classic', 'low', 4, 20),
  m('typeform', '📝', 'Complétez le formulaire Typeform', 'Fill in the Typeform form', 'classic', 'lowPlus', 2, 30, { caution: true }),
  m('quiz', '❓', 'Réalisez un quiz', 'Take a quiz', 'classic', 'low', 4, 20),
  m('mystery_word', '🔤', 'Trouvez un mot mystère', 'Find a mystery word', 'classic', 'low', 4, 20),
  // Avis
  m('review_google', '⭐', 'Déposez un avis Google', 'Leave a Google review', 'avis', 'high', 2, 70),
  m('review_facebook', '⭐', 'Déposez un avis Facebook', 'Leave a Facebook review', 'avis', 'high', 1, 70),
  m('review_site', '⭐', 'Déposez un avis sur le site', 'Leave a review on the website', 'avis', 'high', 2, 70),
  m('review_judgeme', '⭐', 'Déposez un avis produit (Judge.me)', 'Leave a product review (Judge.me)', 'avis', 'high', 2, 70),
  m('review_yotpo', '⭐', 'Déposez un avis produit (Yotpo)', 'Leave a product review (Yotpo)', 'avis', 'high', 2, 70),
  m('review_trustpilot_merchant', '⭐', 'Déposez un avis marchand Trustpilot', 'Leave a Trustpilot merchant review', 'avis', 'high', 2, 70),
  m('review_trustpilot_product', '⭐', 'Déposez un avis produit Trustpilot', 'Leave a Trustpilot product review', 'avis', 'high', 1.5, 70),
  m('review_tripadvisor', '⭐', 'Déposez un avis TripAdvisor', 'Leave a TripAdvisor review', 'avis', 'high', 0.5, 70),
  m('review_app', '⭐', 'Notez notre application', 'Rate our app', 'avis', 'high', 1, 70),
  m('review_video', '🎬', 'Créez un avis vidéo', 'Create a video review', 'avis', 'max', 0.2, 200, { caution: true }),
  // Contenu
  m('photo', '📸', 'Réalisez une photo', 'Take a photo', 'contenu', 'veryHigh', 0.5, 100),
  m('video', '🎥', 'Réalisez une vidéo', 'Make a video', 'contenu', 'max', 0.2, 200),
  m('story_instagram', '📲', 'Publiez une story Instagram', 'Post an Instagram story', 'contenu', 'veryHigh', 0.5, 100),
  m('story_instagram_link', '🔗', 'Publiez une story Instagram avec un lien', 'Post an Instagram story with a link', 'contenu', 'veryHigh', 0.3, 100),
  m('story_instagram_code', '🏷️', 'Publiez une story Instagram avec un code promo', 'Post an Instagram story with a promo code', 'contenu', 'veryHigh', 0.3, 100),
  m('post_instagram', '🖼️', 'Publiez un post Instagram', 'Publish an Instagram post', 'contenu', 'veryHigh', 0.3, 100),
  m('reel_instagram', '🎞️', 'Publiez un Reel Instagram', 'Publish an Instagram Reel', 'contenu', 'max', 0.1, 200),
  m('tiktok_post', '🎵', 'Publiez un TikTok', 'Publish a TikTok', 'contenu', 'max', 0.1, 200),
  // Engagement
  m('follow_instagram', '📸', 'Abonnez-vous à notre compte Instagram', 'Follow our Instagram account', 'engagement', 'lowPlus', 3, 30),
  m('follow_instagram_other', '📸', 'Abonnez-vous à un compte Instagram', 'Follow an Instagram account', 'engagement', 'lowPlus', 2, 30),
  m('follow_tiktok', '🎵', 'Abonnez-vous à notre compte TikTok', 'Follow our TikTok account', 'engagement', 'lowPlus', 2, 30),
  m('whatsapp_group', '💬', 'Rejoignez le groupe WhatsApp', 'Join the WhatsApp group', 'engagement', 'lowPlus', 1, 30),
  m('comment_post', '💬', 'Commentez sous ce post', 'Comment on this post', 'engagement', 'lowPlus', 1, 30, { caution: true }),
  m('tag_friends', '👥', 'Identifiez 2 amis sous le post', 'Tag 2 friends under the post', 'engagement', 'medium', 1, 50),
  m('share_post_story', '🔁', 'Partagez ce post en story', 'Share this post in your story', 'engagement', 'medium', 0.5, 50),
  m('share_last_post_story', '🔁', 'Partagez le dernier post en story', 'Share the latest post in your story', 'engagement', 'medium', 0.5, 50),
  m('share_reel_story', '🔁', 'Partagez un Reel en story', 'Share a Reel in your story', 'engagement', 'medium', 0.5, 50),
  m('download_app', '📲', 'Téléchargez notre application', 'Download our app', 'engagement', 'medium', 1, 50, { caution: true }),
];

// Recommended preset: the default missions of a new program.
export const RECOMMENDED_MISSION_IDS = [
  'purchase', 'account_creation', 'birthday', 'newsletter', 'phone',
  'follow_instagram', 'follow_tiktok', 'review_site', 'photo', 'video', 'story_instagram',
];

export const catalogMission = id => MISSION_CATALOG.find(c => c.id === id);

// Fresh mission objects, ready to be stored in a program.
export const recommendedMissions = () =>
  RECOMMENDED_MISSION_IDS.map(id => ({ ...catalogMission(id), enabled: true }));
