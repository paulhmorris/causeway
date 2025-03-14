import { Body, Container, Head, Html, Preview, Text } from "@react-email/components";

interface Props {
  userFirstName: string;
  contacts: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
  }>;
}

export function EngagementReminderEmail({ userFirstName, contacts }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New income has been added to your account.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi{userFirstName ? " " + userFirstName : ""},</Text>
          <Text style={paragraph}>
            The following contact{contacts.length === 1 ? " has" : "s have"} not been engaged with in at least 30 days.
            This is a friendly reminder to reach out.
          </Text>
          <ul>
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.firstName} {contact.lastName}
              </li>
            ))}
          </ul>
        </Container>
      </Body>
    </Html>
  );
}

EngagementReminderEmail.PreviewProps = {
  url: "https://np-ally.org",
  userFirstName: "Paul",
  contacts: [
    {
      id: "abc123",
      firstName: "John",
      lastName: "Doe",
    },
    {
      id: "abc124",
      firstName: "Jane",
      lastName: "Smith",
    },
  ],
} as Props;

export default EngagementReminderEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};
