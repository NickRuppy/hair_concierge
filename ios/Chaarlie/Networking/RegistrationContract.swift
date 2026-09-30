import Foundation

/// Wire representation of the explicitly scoped registration capability.
/// `completionToken` intentionally never leaves `MobileOnboardingGateway`.
struct RegistrationVerification: Codable, Equatable, Sendable {
    let userId: UUID
    let hasExistingProfile: Bool
    let profileRevision: String
    let completionToken: String
}

struct RegistrationCompletion: Codable, Sendable {
    /// Exactly one of a ready session/bootstrap pair or a completion authority is returned.
    let session: MobileSession?
    let bootstrap: Bootstrap?
    let status: Bootstrap.Status?
    let completionToken: String?
    let profileRevision: String?
    init(session: MobileSession? = nil, bootstrap: Bootstrap? = nil, status: Bootstrap.Status? = nil,
         completionToken: String? = nil, profileRevision: String? = nil) {
        self.session = session; self.bootstrap = bootstrap
        self.status = status
        self.completionToken = completionToken; self.profileRevision = profileRevision
    }
}

/// `auth/verify` preserves the pilot's legacy flat session response while also
/// accepting an incomplete-profile completion authority. Neither form is installed
/// by `MobileClient`; the app model decides after checking its current epoch.
struct AuthVerificationResponse: Decodable, Sendable {
    let session: MobileSession?
    let completionToken: String?
    let profileRevision: String?
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if container.contains(.status) {
            guard try container.decode(Bootstrap.Status.self, forKey: .status) == .profile_required,
                  !container.contains(.session),
                  let token = try container.decodeIfPresent(String.self, forKey: .completionToken), !token.isEmpty,
                  let revision = try container.decodeIfPresent(String.self, forKey: .profileRevision), !revision.isEmpty else {
                throw MobileError.invalidResponse
            }
            session = nil
            completionToken = token
            profileRevision = revision
        } else {
            session = try MobileSession(from: decoder)
            completionToken = nil
            profileRevision = nil
        }
    }
    private enum CodingKeys: String, CodingKey { case session, completionToken, profileRevision, status }
}

struct RegistrationCompleteRequest: Codable, Sendable {
    enum Choice: String, Codable, Sendable { case create, keep, replace }
    let completionToken: String
    let submission: RegistrationSubmissionBody
    let choice: Choice
    let expectedProfileRevision: String
}

struct RegistrationSubmissionBody: Codable, Equatable, Sendable {
    let requestId: UUID
    let answers: QuizAnswers
    let firstName: String
    let email: String
    let marketingOptIn: Bool
}

struct MissingProfileCompletion: Codable, Sendable {
    let profileRevision: String
    let questions: [EditQuestion]
    let answers: PartialQuizAnswers
}

struct PartialQuizAnswers: Codable, Equatable, Sendable {
    var structure: String?
    var thickness: String?
    var density: String?
    var hair_length: String?
    var fingertest: String?
    var pulltest: String?
    var scalp_type: String?
    var has_scalp_issue: Bool?
    var scalp_condition: String?
    var treatment: [String]?
    var concerns: [String]?
    var goals: [String]?
    var concerns_other_text: String?

    init(structure: String? = nil, thickness: String? = nil, density: String? = nil, hair_length: String? = nil,
         fingertest: String? = nil, pulltest: String? = nil, scalp_type: String? = nil, has_scalp_issue: Bool? = nil,
         scalp_condition: String? = nil, treatment: [String]? = nil, concerns: [String]? = nil, goals: [String]? = nil,
         concerns_other_text: String? = nil) {
        self.structure = structure; self.thickness = thickness; self.density = density; self.hair_length = hair_length
        self.fingertest = fingertest; self.pulltest = pulltest; self.scalp_type = scalp_type; self.has_scalp_issue = has_scalp_issue
        self.scalp_condition = scalp_condition; self.treatment = treatment; self.concerns = concerns; self.goals = goals
        self.concerns_other_text = concerns_other_text
    }

    mutating func set(_ values: [String], for id: String) {
        switch id {
        case "structure": structure = values.first
        case "thickness": thickness = values.first
        case "density": density = values.first
        case "hair_length": hair_length = values.first
        case "fingertest": fingertest = values.first
        case "pulltest": pulltest = values.first
        case "scalp_type": scalp_type = values.first
        case "treatment": treatment = values
        case "concerns": concerns = values
        case "goals": goals = values
        default: break
        }
    }
}

struct MissingProfileCompletionRequest: Codable, Sendable {
    let requestId: UUID
    let expectedProfileRevision: String
    let answers: PartialQuizAnswers
}
